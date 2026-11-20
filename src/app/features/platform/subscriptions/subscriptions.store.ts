import { Injectable, computed, inject, signal } from '@angular/core';
import { Clock } from '../../../core/clock';
import type { Id, TenantPlan } from '../../../shared/api/models';
import { calendarDay } from '../../../shared/format/date-time';
import type { Day, NewPayment, PlanTerms, Subscription } from './subscription.models';
import { addDays, monthOf, nextMonthDay } from './subscription.rules';
import { SAMPLE_PLANS, sampleSubscriptions } from './subscription.sample';

const ZONE = 'America/Caracas';

/**
 * The console's subscriptions, for now the sample of subscription.sample.ts kept in memory: what is
 * done here (payments, plan changes, grace) lasts until the page is reloaded and never reaches the
 * server. When billing exists, this is the one place that changes to read and write remotely.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionsStore {
  private readonly clock = inject(Clock);

  /** Shown on every screen of the tab while the data is made up. */
  readonly isSample = true;
  readonly plans = signal<PlanTerms[]>(SAMPLE_PLANS);
  private readonly items = signal<Subscription[]>(sampleSubscriptions(this.today()));
  readonly subscriptions = this.items.asReadonly();
  readonly byId = computed(() => new Map(this.items().map((s) => [s.id, s])));

  today(): Day {
    return calendarDay(this.clock.now().toISOString(), ZONE);
  }

  terms(plan: TenantPlan): PlanTerms {
    return this.plans().find((p) => p.plan === plan)!;
  }

  /** Pays the first month still owed: the next charge moves one month and any grace ends. */
  registerPayment(id: Id, payment: NewPayment): void {
    this.update(id, (sub) => {
      const record = { id: `${id}-p${Date.now()}`, month: monthOf(sub.nextChargeOn), ...payment };
      return {
        ...sub,
        payments: [record, ...sub.payments],
        nextChargeOn: nextMonthDay(sub.nextChargeOn, sub.billingDay),
        graceUntil: null,
      };
    });
  }

  /** The new fee applies from the next charge, never to the month already running. */
  changePlan(id: Id, plan: TenantPlan): void {
    this.update(id, (sub) => ({ ...sub, plan }));
  }

  giveGrace(id: Id, days: number): void {
    this.update(id, (sub) => ({ ...sub, graceUntil: addDays(this.today(), days) }));
  }

  private update(id: Id, change: (sub: Subscription) => Subscription): void {
    this.items.update((list) => list.map((sub) => (sub.id === id ? change(sub) : sub)));
  }
}
