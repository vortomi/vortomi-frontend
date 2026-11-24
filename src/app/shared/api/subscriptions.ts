import type { Id } from './models';

/*
 * A company's subscription to Vortomi, as the server sends it (documentations/18, stage 2):
 * GET /tenants/:id/subscription (the company) and /platform/tenants/:id/subscription (the console),
 * and the rows of GET /platform/subscriptions (Suscripciones → Cobros).
 */

/** A calendar day, "2026-12-21", in Caracas time. */
export type Day = string;

/** Percent off for paying at least 1, 3, 6 or 12 months. */
export type PlanDiscounts = Record<'1' | '3' | '6' | '12', number>;

/**
 * Derived from the dates, never stored. Due day D: grace D+1 and D+2, suspended from 00:00 of D+3.
 * Before the first payment: 3 days from the day the plan was assigned.
 */
export type BillingState = 'awaiting_first_payment' | 'active' | 'due_soon' | 'grace' | 'suspended';

/** What is being paid now: its price and discounts are fixed when the charge is made. */
export interface SubscriptionCharge {
  id: Id;
  planName: string;
  basePriceCents: number;
  discounts: PlanDiscounts;
  months: number;
  discountPercent: number;
  amountCents: number;
  paidCents: number;
  dueOn: Day;
}

export interface SubscriptionView {
  state: BillingState;
  /** Whether an unpaid company is really locked out (off until companies can pay from the panel). */
  enforced: boolean;
  plan: { id: Id; name: string; description: string; priceCents: number; discounts: PlanDiscounts; benefits: string[] };
  assignedAt: string;
  /** Set by the first payment; null before it. */
  billingDay: number | null;
  nextDueOn: Day;
  /** From 00:00 of this day the company is suspended if it still owes. */
  suspendsOn: Day;
  owedCents: number;
  /** The charge being paid now; null when nothing is owed. */
  charge: SubscriptionCharge | null;
  /** Vortomi's exchange rate, or null while it has none. */
  rate: { bsPerUsd: string; effectiveDate: Day } | null;
}

/** A row of Suscripciones → Cobros: every company, with or without a plan. */
export interface SubscriptionRow {
  tenantId: Id;
  tenantName: string;
  planName: string | null;
  billingDay: number | null;
  nextDueOn: Day | null;
  suspendsOn: Day | null;
  owedCents: number;
  /** 'none': no plan yet. */
  state: BillingState | 'none';
}
