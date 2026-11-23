import type { Id } from '../../shared/api/models';

/** A calendar day, "2026-12-21", in Caracas time. */
export type Day = string;

export const PERIODS = [1, 3, 6, 12] as const;
export type Period = (typeof PERIODS)[number];

/** A plan as the company sees it (GET /tenants/:id/plans): only the active ones. */
export interface CompanyPlan {
  id: Id;
  name: string;
  description: string;
  /** Base price per month, integer cents. */
  priceCents: number;
  /** Percent off for paying at least 1, 3, 6 or 12 months. */
  discounts: Record<'1' | '3' | '6' | '12', number>;
  benefits: string[];
}

/** How much of a limited benefit the company uses («Usuarios 4 de 5»). */
export interface UsageMeter {
  label: string;
  used: number;
  /** null: included without a limit (shown with a ✓). */
  limit: number | null;
  /** «Se reinicia el 1 dic», «Te queda 1». */
  hint?: string;
}

export type PaymentStatus = 'approved' | 'in_review' | 'rejected';

export interface SubscriptionPayment {
  id: Id;
  paidOn: Day;
  planName: string;
  months: number;
  /** The period it pays for. */
  from: Day;
  to: Day;
  discountPercent: number;
  amountCents: number;
  method: string;
  reference: string;
  status: PaymentStatus;
}

/** Something that happened or will happen, for the timeline. */
export interface SubscriptionEvent {
  on: Day;
  kind: 'next_payment' | 'price_change' | 'payment' | 'plan_change';
  title: string;
  detail: string;
}

/** The company's subscription: its plan, the period paid and its payments. */
export interface CompanySubscription {
  planName: string;
  months: number;
  discountPercent: number;
  /** What the period paid cost. */
  amountCents: number;
  /** The plan's base price per month today: the next payment starts from it. */
  monthlyBaseCents: number;
  startsOn: Day;
  /** The plan is due this day at 11:59 p. m., Caracas time. */
  endsOn: Day;
  benefits: UsageMeter[];
  /** Newest first. */
  payments: SubscriptionPayment[];
  /** Newest first; the next payment included. */
  events: SubscriptionEvent[];
}
