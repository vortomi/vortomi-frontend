import type { Id, TenantPlan } from '../../../shared/api/models';

/** A calendar day, "2026-11-19", always in Caracas time. */
export type Day = string;

export type PaymentMethod = 'mobile_payment' | 'transfer' | 'zelle' | 'cash';

/** Where a company stands with its monthly fee today. */
export type BillingStatus = 'paid' | 'due_soon' | 'overdue' | 'grace' | 'trial' | 'free';

/** What a plan costs and what it allows (fixed fee per company, option A of mockup web-32). */
export interface PlanTerms {
  plan: TenantPlan;
  /** Monthly fee in integer cents; 0 for the internal plan. */
  priceCents: number;
  /** null: no limit. */
  users: number | null;
  numbers: number | null;
  features: { text: string; included: boolean }[];
}

/** A payment a company made to Vortomi (to be reported by the company from its panel). */
export interface SubscriptionPayment {
  id: Id;
  /** The month it pays, "2026-11". */
  month: string;
  amountCents: number;
  method: PaymentMethod;
  /** Empty for cash. */
  reference: string;
  paidOn: Day;
  /** Name of the receipt picked in the dialog; the file itself is not kept. */
  receiptName: string | null;
}

export interface Subscription {
  id: Id;
  companyName: string;
  /** «Repuestos · Caracas», under the name. */
  companyLine: string;
  plan: TenantPlan;
  since: Day;
  /** Day of the month the fee is due. */
  billingDay: number;
  /** The first month not paid yet is due this day. */
  nextChargeOn: Day;
  /** Free trial: no fee until this day (inclusive). */
  trialEndsOn: Day | null;
  /** Grace given by our team: not counted as overdue until this day (inclusive). */
  graceUntil: Day | null;
  usersUsed: number;
  numbersUsed: number;
  /** Newest first. */
  payments: SubscriptionPayment[];
}
