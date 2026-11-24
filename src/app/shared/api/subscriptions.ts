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
 * Before the first payment: 3 days from the day the plan was assigned. 'in_review': a payment in
 * review covers the whole debt, so the company works as if it owed nothing until it is decided.
 * 'exempt': Vortomi exempted it from paying (mockup web-49).
 */
export type BillingState = 'awaiting_first_payment' | 'active' | 'due_soon' | 'grace' | 'suspended' | 'in_review' | 'exempt';

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
  /** Chosen by the company itself, or assigned by Vortomi's console as an exception. */
  origin: 'company' | 'console';
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
  /** The payment the console is reviewing, if any. */
  inReview: SubscriptionPayment | null;
  /** The balance in favour, in dollar cents: taken from the next charge when it is made. */
  walletCents: number;
}

export type PaymentCurrency = 'USD' | 'VES';
export type ProofRule = 'required' | 'optional' | 'none';

/** A method of Vortomi a company pays with (GET /tenants/:id/subscription/methods). */
export interface PayableMethod {
  id: Id;
  type: string;
  name: string;
  currency: PaymentCurrency;
  fields: { kind: string; label: string; value: string; copyable: boolean }[];
  instructions: string;
  referenceRule: ProofRule;
  receiptRule: ProofRule;
}

/** A payment the company reported (GET /tenants/:id/subscription/payments). */
export interface SubscriptionPayment {
  id: Id;
  status: 'in_review' | 'approved' | 'rejected';
  months: number;
  methodId: Id | null;
  methodName: string;
  methodType: string;
  currency: PaymentCurrency;
  /** Who paid, as the method's form asks it. */
  payer: Record<string, string>;
  reference: string | null;
  paidOn: Day;
  /** "1234.56" in the method's currency. */
  amount: string;
  bsPerUsd: string | null;
  amountUsdCents: number;
  hasProof: boolean;
  rejectionReason: string | null;
  rejectionNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  /** Vortomi's receipt of it, once approved. */
  receiptNumber: number | null;
}

/** POST /tenants/:id/subscription/payments (and PUT to correct a rejected one). */
export interface PaymentReport {
  methodId: Id;
  months: 1 | 3 | 6 | 12;
  paidOn: Day;
  amount: string;
  reference?: string;
  payer: Record<string, string>;
  /** Left out when correcting: the receipt stays. */
  proof?: { mimeType: string; data: string } | null;
}

/** GET /tenants/:id/subscription: the company's plan, or its trial while it has none (mockup web-38). */
export interface CompanySubscriptionView {
  subscription: SubscriptionView | null;
  /** The last day of its trial to choose a plan; null for a company that never had one. */
  trialEndsOn: Day | null;
  /** Its exemption from paying while it lasts: its last exempt day, or null with no end. */
  exemption: { endsOn: Day | null } | null;
  enforced: boolean;
  rate: SubscriptionView['rate'];
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
  /** 'none': no plan yet (and not exempt). */
  state: BillingState | 'none';
  /** Its exemption while it lasts. */
  exemption: { reason: ExemptionReason; endsOn: Day | null } | null;
}

/** Why Vortomi exempts a company from paying (mockup web-49). */
export type ExemptionReason = 'demo' | 'internal' | 'founder' | 'agreement' | 'other';

/** A company's exemption, as the console sees it (GET /platform/tenants/:id/exemption). */
export interface ExemptionView {
  reason: ExemptionReason;
  /** Vortomi's only: the company never sees it. */
  note: string | null;
  /** The last exempt day; null: no end. */
  endsOn: Day | null;
  forgivenCents: number;
  grantedAt: string;
  grantedByName: string | null;
}

/** «Exonerar del pago»: a reason, a note (needed for «other») and until when. */
export interface ExemptionInput {
  reason: ExemptionReason;
  note: string | null;
  endsOn: Day | null;
}

/** The balance in favour and its movements (GET /tenants/:id/subscription/wallet). */
export interface Wallet {
  balanceCents: number;
  movements: { id: Id; kind: 'excess' | 'applied'; amountCents: number; paymentId: Id | null; chargeId: Id | null; createdAt: string }[];
}

export type PaymentRejectionReason = 'reference_not_found' | 'amount_mismatch' | 'unreadable_proof' | 'wrong_method' | 'other';

/** How a payment compares with what its company owes now. */
export type Coverage = 'full' | 'partial' | 'extra';

/** A row of Suscripciones → Pagos (GET /platform/subscription-payments). */
export interface ReviewRow {
  id: Id;
  tenantId: Id;
  tenantName: string;
  status: SubscriptionPayment['status'];
  planName: string | null;
  months: number;
  methodName: string;
  reference: string | null;
  paidOn: Day;
  submittedAt: string;
  currency: PaymentCurrency;
  amount: string;
  amountUsdCents: number;
  owedCents: number;
  coverage: Coverage;
  receiptNumber: number | null;
}

/** One payment to review (GET /platform/subscription-payments/:id). */
export interface ReviewDetail extends ReviewRow {
  payment: SubscriptionPayment & { receivedAmount: string | null; receivedUsdCents: number | null };
  charge: { months: number; amountCents: number; paidCents: number; dueOn: Day; discountPercent: number } | null;
  billingDay: number | null;
  nextDueOn: Day | null;
}
