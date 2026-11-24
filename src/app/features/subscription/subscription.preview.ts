import type { BillingState, CompanySubscriptionView, SubscriptionPayment, SubscriptionView, Wallet } from '../../shared/api/subscriptions';
import { PREVIEW_PLAN, previewSubscription } from '../../shared/api/subscriptions.preview';
import type { CompanyPlan, Period } from './subscription.models';
import { addDays, priceFor } from './subscription.rules';

/*
 * PREVIEW ONLY ('mock' mode, never deployed): Vortomi's plans and a company's subscription, so the
 * screens can be reviewed without a server. «?estado=» picks what the company looks like:
 * trial (default: no plan, 5 days left), trial_over, none (no plan, no trial),
 * awaiting_first_payment, active, due_soon, grace or suspended; exempt, exempt_until or exempt_ending.
 */

/** The preview's plans, as the console would list them. */
export const PREVIEW_PLANS: CompanyPlan[] = [
  {
    id: 'plan-basic',
    name: 'Básico',
    description: 'Para negocios que empiezan con un solo número.',
    priceCents: 3900,
    discounts: { '1': 0, '3': 5, '6': 10, '12': 15 },
    benefits: ['1 número de WhatsApp', 'Agente de ventas con IA', 'Inventario y pedidos'],
  },
  PREVIEW_PLAN,
];

const STATES: readonly Exclude<BillingState, 'exempt'>[] = ['awaiting_first_payment', 'active', 'due_soon', 'grace', 'suspended', 'in_review'];
const RATE = (today: string) => ({ bsPerUsd: '410.55000000', effectiveDate: today });

/** What GET /tenants/:id/subscription would answer, for the state «?estado=» asks for. */
export function previewView(today: string, search: string): CompanySubscriptionView {
  const view = previewState(today, search);
  // «?tasa=no»: Vortomi has not published its rate yet.
  if (new URLSearchParams(search).get('tasa') !== 'no') return view;
  return { ...view, rate: null, subscription: view.subscription ? { ...view.subscription, rate: null } : null };
}

function previewState(today: string, search: string): CompanySubscriptionView {
  const asked = new URLSearchParams(search).get('estado') ?? 'trial';
  const state = STATES.find((s) => s === asked);
  if (state) return { subscription: previewSubscription(today, state), trialEndsOn: addDays(today, -20), exemption: null, enforced: true, rate: RATE(today) };
  // Exempt from paying (mockup web-49): with no end, until a day, or ending within the week.
  const exemptUntil: Record<string, string | null> = { exempt: null, exempt_until: addDays(today, 90), exempt_ending: addDays(today, 4) };
  if (asked in exemptUntil) return { subscription: null, trialEndsOn: addDays(today, -20), exemption: { endsOn: exemptUntil[asked] ?? null }, enforced: true, rate: RATE(today) };
  const trialEndsOn = asked === 'trial_over' ? addDays(today, -1) : asked === 'none' ? null : addDays(today, 4);
  return { subscription: null, trialEndsOn, exemption: null, enforced: true, rate: RATE(today) };
}

/** What choosing a plan would answer: its first charge, for the months chosen, due today. */
export function previewChoice(plan: CompanyPlan, months: Period, today: string, rate: SubscriptionView['rate']): SubscriptionView {
  const base = previewSubscription(today, 'awaiting_first_payment');
  const price = priceFor(plan, months);
  return {
    ...base,
    plan: { id: plan.id, name: plan.name, description: plan.description, priceCents: plan.priceCents, discounts: plan.discounts, benefits: plan.benefits },
    origin: 'company',
    owedCents: price.totalCents,
    charge: { ...base.charge!, planName: plan.name, basePriceCents: plan.priceCents, discounts: plan.discounts, months, discountPercent: price.discountPercent, amountCents: price.totalCents },
    rate,
  };
}

const PAID: SubscriptionPayment = {
  id: 'payment-paid',
  status: 'approved',
  months: 1,
  methodId: 'method-zelle',
  methodName: 'Zelle',
  methodType: 'zelle',
  currency: 'USD',
  payer: { holder: 'Laura Méndez', email: 'laura@repuestosandinos.com' },
  reference: 'ZX10001',
  paidOn: '2026-11-04',
  amount: '84.00',
  bsPerUsd: null,
  amountUsdCents: 8400,
  hasProof: true,
  rejectionReason: null,
  rejectionNote: null,
  submittedAt: '2026-11-04T15:00:00.000Z',
  reviewedAt: '2026-11-04T18:00:00.000Z',
  receiptNumber: 1,
};

const active = (search: string) => new URLSearchParams(search).get('estado') === 'active';

/** The company's payments at the start of the preview: with «?estado=active», a month paid with 5 $ extra. */
export function previewPayments(search: string): SubscriptionPayment[] {
  return active(search) ? [PAID] : [];
}

/** Its wallet: those 5 $, the same as its subscription's walletCents. */
export function previewWallet(search: string): Wallet {
  if (!active(search)) return { balanceCents: 0, movements: [] };
  return { balanceCents: 500, movements: [{ id: 'move-1', kind: 'excess', amountCents: 500, paymentId: PAID.id, chargeId: null, createdAt: '2026-11-04T18:00:00.000Z' }] };
}
