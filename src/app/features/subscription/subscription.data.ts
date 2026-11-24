import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import { API_CONFIG } from '../../core/api/api-config';
import { Clock } from '../../core/clock';
import { CompanyLock } from '../../core/company-lock';
import { Session } from '../../core/session';
import type { CompanySubscriptionView, SubscriptionPayment, SubscriptionView } from '../../shared/api/subscriptions';
import { formatUsdCents } from '../../shared/format/money';
import type { CompanyPlan, Period } from './subscription.models';
import { PREVIEW_PLANS, previewChoice, previewView } from './subscription.preview';
import { caracasDay, countdownTarget, exemptionBadge, exemptionNotice, subscriptionBadge, subscriptionNotice, trialBadge, trialDaysLeft, trialNotice } from './subscription.rules';

/** The countdown moves in minutes: a tick every 15 s keeps it on time without waste. */
const TICK_MS = 15_000;

/**
 * The company's Suscripción (mockups web-37 and web-38): its plan, what it owes and until when, or
 * its trial while it has no plan, from GET /tenants/:id/subscription; Vortomi's active plans; and
 * choosing its plan itself. Only the company's owner and admins read it. The banner, the menu count
 * and the lock screen come from here.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionData {
  private readonly clock = inject(Clock);
  private readonly api = inject(ApiClient);
  private readonly session = inject(Session);
  private readonly lock = inject(CompanyLock);
  private readonly live = inject(API_CONFIG).mode === 'api';
  /** The preview reads «?estado=» once; what is done afterwards (a plan chosen, a payment sent) stays. */
  private previewSeeded = false;

  readonly now = signal(this.clock.now());
  readonly today = computed(() => caracasDay(this.now()));

  /** null: the company has no plan yet. */
  readonly subscription = signal<SubscriptionView | null>(null);
  /** The last day of its trial to choose a plan (only matters while it has none). */
  readonly trialEndsOn = signal<string | null>(null);
  /** Its exemption from paying while it lasts (mockup web-49): nothing is charged, nothing locks. */
  readonly exemption = signal<CompanySubscriptionView['exemption']>(null);
  /** Whether a company past its dates is really locked out (BILLING_ENFORCEMENT). */
  readonly enforced = signal(false);
  /** Vortomi's rate, for the bolívares; there even without a plan, for choosing one. */
  readonly rate = signal<SubscriptionView['rate']>(null);
  readonly loaded = signal(false);
  readonly failed = signal(false);

  readonly target = computed(() => {
    const s = this.subscription();
    return s ? countdownTarget(s) : null;
  });
  /** Without a plan, the trial's days left (0 once it is over); null with a plan or no trial. */
  readonly trialLeft = computed(() => {
    const endsOn = this.trialEndsOn();
    return this.subscription() || !endsOn ? null : trialDaysLeft(endsOn, this.today());
  });
  /** The menu's «2 d» for the company's admins. */
  readonly badge = computed(() => {
    const exemption = this.exemption();
    if (exemption) return exemptionBadge(exemption.endsOn, this.today());
    const s = this.subscription();
    if (s) return subscriptionBadge(s, this.today());
    const endsOn = this.trialEndsOn();
    return endsOn ? trialBadge(endsOn, this.today()) : null;
  });
  readonly notice = computed(() => {
    const exemption = this.exemption();
    if (exemption) return exemptionNotice(exemption.endsOn, this.today(), this.subscription());
    const s = this.subscription();
    if (s) return subscriptionNotice(s, formatUsdCents);
    const endsOn = this.trialEndsOn();
    return endsOn ? trialNotice(endsOn, this.today(), this.enforced()) : null;
  });
  /** Suspended (for not paying, or with the trial over and no plan) and the rule enforced. */
  readonly locked = computed(() => {
    if (this.exemption()) return false;
    const s = this.subscription();
    if (s) return s.state === 'suspended' && s.enforced;
    return this.enforced() && this.trialLeft() === 0;
  });

  readonly plans = signal<CompanyPlan[]>([]);
  readonly plansLoaded = signal(false);
  readonly plansFailed = signal(false);

  constructor() {
    const timer = setInterval(() => this.now.set(this.clock.now()), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    // Each company of the session has its own: read it again when the company changes.
    effect(() => {
      const tenantId = this.session.tenant()?.id;
      const admin = this.session.isTenantAdmin();
      untracked(() => {
        this.apply({ subscription: null, trialEndsOn: null, exemption: null, enforced: false, rate: null });
        this.loaded.set(false);
        if (tenantId && admin) void this.load();
      });
    });
  }

  async load(): Promise<void> {
    this.failed.set(false);
    try {
      if (!this.live) {
        if (!this.previewSeeded) this.apply(previewView(this.today(), location.search));
        this.previewSeeded = true;
      } else {
        const tenantId = this.session.tenant()?.id;
        if (!tenantId) return;
        this.apply(await this.api.get<CompanySubscriptionView>(this.api.company(tenantId, 'subscription')));
        // The lock follows the server: on while suspended, off once it chose and paid.
        if (this.locked()) this.lock.markUnpaid(tenantId);
        else this.lock.clear(tenantId);
      }
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }

  /** The company chooses its plan and the months it means to pay (mockup web-38): its first charge, due today. */
  async choose(plan: CompanyPlan, months: Period): Promise<SubscriptionView> {
    let view: SubscriptionView;
    if (!this.live) {
      view = previewChoice(plan, months, this.today(), this.rate());
    } else {
      const tenantId = this.session.tenant()?.id;
      if (!tenantId) throw new Error('No company in the session');
      view = (await this.api.post<{ subscription: SubscriptionView }>(this.api.company(tenantId, 'subscription'), { planId: plan.id, months })).subscription;
      this.lock.clear(tenantId);
    }
    this.subscription.set(view);
    return view;
  }

  /** A payment just sent: in review now; it covers the debt or not. */
  async afterPayment(payment: SubscriptionPayment): Promise<void> {
    if (this.live) return this.load();
    const s = this.subscription();
    if (!s) return;
    const covers = s.owedCents > 0 && payment.amountUsdCents >= s.owedCents;
    this.subscription.set({ ...s, inReview: payment, state: covers ? 'in_review' : s.state });
  }

  async loadPlans(): Promise<void> {
    this.plansFailed.set(false);
    try {
      if (!this.live) {
        this.plans.set(PREVIEW_PLANS);
      } else {
        const tenantId = this.session.tenant()?.id;
        if (!tenantId) return;
        this.plans.set((await this.api.get<{ items: CompanyPlan[] }>(this.api.company(tenantId, 'plans'))).items);
      }
    } catch {
      this.plansFailed.set(true);
    } finally {
      this.plansLoaded.set(true);
    }
  }

  private apply(view: CompanySubscriptionView): void {
    this.subscription.set(view.subscription);
    this.trialEndsOn.set(view.trialEndsOn);
    this.exemption.set(view.exemption);
    this.enforced.set(view.enforced);
    this.rate.set(view.rate);
  }
}
