import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import { API_CONFIG } from '../../core/api/api-config';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { CompanyPlan } from './subscription.models';
import { caracasDay, dueAt, reminderBadge, reminderOf } from './subscription.rules';
import { PREVIEW_PLANS, sampleSubscription } from './subscription.sample';

/** The countdown moves in minutes: a tick every 15 s keeps it on time without waste. */
const TICK_MS = 15_000;

/**
 * The company's Suscripción (mockup web-35): its plan, period, payments and usage, and Vortomi's
 * active plans. The plans are real (GET /tenants/:id/plans); the company's own subscription is
 * sample data until companies are linked to plans, and while it is, the reminders outside this
 * section (banner, menu count) stay off for real companies: a made-up due date must never reach
 * them. In the preview ('mock' mode) they show, so the screens can be reviewed.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionData {
  private readonly clock = inject(Clock);
  private readonly api = inject(ApiClient);
  private readonly session = inject(Session);
  private readonly live = inject(API_CONFIG).mode === 'api';

  readonly now = signal(this.clock.now());
  readonly today = computed(() => caracasDay(this.now()));

  /** Made-up until the server keeps each company's subscription. */
  readonly isSample = true;
  readonly subscription = signal(sampleSubscription(caracasDay(this.clock.now())));

  readonly due = computed(() => dueAt(this.subscription().endsOn));
  readonly reminder = computed(() => reminderOf(this.now(), this.due()));
  /** Banner and menu count: real data, or the preview. */
  readonly remindersOn = !this.isSample || !this.live;
  /** The menu's «6 d» for the company's admins, when a reminder is due. */
  readonly badge = computed(() => (this.remindersOn && this.session.isTenantAdmin() ? reminderBadge(this.reminder()) : null));

  readonly plans = signal<CompanyPlan[]>([]);
  readonly plansLoaded = signal(false);
  readonly plansFailed = signal(false);

  constructor() {
    const timer = setInterval(() => this.now.set(this.clock.now()), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
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
