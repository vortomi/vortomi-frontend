import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import { API_CONFIG } from '../../core/api/api-config';
import { Clock } from '../../core/clock';
import { CompanyLock } from '../../core/company-lock';
import { Session } from '../../core/session';
import type { SubscriptionView } from '../../shared/api/subscriptions';
import { formatUsdCents } from '../../shared/format/money';
import type { CompanyPlan } from './subscription.models';
import { PREVIEW_PLANS, previewState, previewSubscription } from './subscription.preview';
import { caracasDay, countdownTarget, subscriptionBadge, subscriptionNotice } from './subscription.rules';

/** The countdown moves in minutes: a tick every 15 s keeps it on time without waste. */
const TICK_MS = 15_000;

/**
 * The company's Suscripción (mockup web-37): its plan, what it owes and until when, from
 * GET /tenants/:id/subscription; and Vortomi's active plans. Only the company's owner and admins
 * read it. The banner, the menu count and the lock screen come from here.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionData {
  private readonly clock = inject(Clock);
  private readonly api = inject(ApiClient);
  private readonly session = inject(Session);
  private readonly lock = inject(CompanyLock);
  private readonly live = inject(API_CONFIG).mode === 'api';

  readonly now = signal(this.clock.now());
  readonly today = computed(() => caracasDay(this.now()));

  /** null: the company has no plan yet. */
  readonly subscription = signal<SubscriptionView | null>(null);
  readonly loaded = signal(false);
  readonly failed = signal(false);

  readonly target = computed(() => {
    const s = this.subscription();
    return s ? countdownTarget(s) : null;
  });
  /** The menu's «2 d» for the company's admins. */
  readonly badge = computed(() => {
    const s = this.subscription();
    return s ? subscriptionBadge(s, this.today()) : null;
  });
  readonly notice = computed(() => {
    const s = this.subscription();
    return s ? subscriptionNotice(s, formatUsdCents) : null;
  });
  /** Suspended for not paying, and the rule enforced: everything but Suscripción is closed. */
  readonly locked = computed(() => {
    const s = this.subscription();
    return s?.state === 'suspended' && s.enforced;
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
        this.subscription.set(null);
        this.loaded.set(false);
        if (tenantId && admin) void this.load();
      });
    });
  }

  async load(): Promise<void> {
    this.failed.set(false);
    try {
      if (!this.live) {
        const state = previewState(location.search);
        this.subscription.set(state ? previewSubscription(this.today(), state) : null);
      } else {
        const tenantId = this.session.tenant()?.id;
        if (!tenantId) return;
        const { subscription } = await this.api.get<{ subscription: SubscriptionView | null }>(this.api.company(tenantId, 'subscription'));
        this.subscription.set(subscription);
        // The lock follows the server: on while suspended, off once paid.
        if (subscription?.state === 'suspended' && subscription.enforced) this.lock.markUnpaid(tenantId);
        else this.lock.clear(tenantId);
      }
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
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
}
