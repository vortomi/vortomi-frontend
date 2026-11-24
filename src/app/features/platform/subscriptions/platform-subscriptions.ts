import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../core/api/api-client';
import { API_CONFIG } from '../../../core/api/api-config';
import { Clock } from '../../../core/clock';
import type { Id } from '../../../shared/api/models';
import type { BillingState, SubscriptionRow, SubscriptionView } from '../../../shared/api/subscriptions';
import { previewSubscription } from '../../../shared/api/subscriptions.preview';
import { PlatformData } from '../platform.data';
import { PlatformPlans } from '../plans/platform-plans';

/** Caracas has no summer time: always UTC-4. */
const caracasToday = (now: Date) => new Date(now.getTime() - 4 * 3_600_000).toISOString().slice(0, 10);

/** The preview's companies, in turn: one of each state, then the rest without a plan. */
const PREVIEW_STATES: BillingState[] = ['awaiting_first_payment', 'grace', 'active'];

/**
 * Each company's subscription from the console (documentations/18, stage 2; mockup web-37):
 * Suscripciones → Cobros, the «Suscripción» box of a company's page, and assigning a plan. In the
 * preview without a server they live in memory.
 */
@Injectable({ providedIn: 'root' })
export class PlatformSubscriptions {
  private readonly api = inject(ApiClient);
  private readonly live = inject(API_CONFIG).mode === 'api';
  private readonly clock = inject(Clock);
  private readonly platform = inject(PlatformData);
  private readonly plans = inject(PlatformPlans);
  private preview: Map<Id, SubscriptionView> | null = null;

  async list(): Promise<SubscriptionRow[]> {
    if (this.live) return (await this.api.get<{ items: SubscriptionRow[] }>('platform/subscriptions')).items;
    const views = this.previewViews();
    return this.platform
      .rows()
      .filter((r) => r.tenant.status !== 'draft')
      .map(({ tenant }): SubscriptionRow => {
        const s = views.get(tenant.id);
        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          planName: s?.plan.name ?? null,
          billingDay: s?.billingDay ?? null,
          nextDueOn: s?.nextDueOn ?? null,
          suspendsOn: s?.suspendsOn ?? null,
          owedCents: s?.owedCents ?? 0,
          state: s?.state ?? 'none',
        };
      })
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName, 'es'));
  }

  /** null: the company has no plan yet. */
  async view(tenantId: Id): Promise<SubscriptionView | null> {
    if (this.live) return (await this.api.get<{ subscription: SubscriptionView | null }>(`platform/tenants/${encodeURIComponent(tenantId)}/subscription`)).subscription;
    return this.previewViews().get(tenantId) ?? null;
  }

  /** The plan and its first charge (1 month, due today): the company has 3 days to pay. */
  async assign(tenantId: Id, planId: Id): Promise<SubscriptionView> {
    if (this.live) {
      const path = `platform/tenants/${encodeURIComponent(tenantId)}/subscription`;
      return (await this.api.post<{ subscription: SubscriptionView }>(path, { planId })).subscription;
    }
    const plan = (await this.plans.list()).find((p) => p.id === planId);
    if (!plan) throw new Error('Plan not found');
    const base = previewSubscription(caracasToday(this.clock.now()), 'awaiting_first_payment');
    const { id, name, description, priceCents, discounts, benefits } = plan;
    const charge = { ...base.charge!, planName: name, basePriceCents: priceCents, discounts, amountCents: priceCents };
    const view: SubscriptionView = { ...base, origin: 'console', enforced: false, plan: { id, name, description, priceCents, discounts, benefits }, owedCents: priceCents, charge };
    this.previewViews().set(tenantId, view);
    return view;
  }

  private previewViews(): Map<Id, SubscriptionView> {
    if (!this.preview) {
      const today = caracasToday(this.clock.now());
      const tenants = this.platform.rows().filter((r) => r.tenant.status !== 'draft');
      this.preview = new Map(PREVIEW_STATES.flatMap((state, i) => (tenants[i] ? [[tenants[i].tenant.id, { ...previewSubscription(today, state), enforced: false }] as const] : [])));
    }
    return this.preview;
  }
}
