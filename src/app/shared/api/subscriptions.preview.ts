import type { BillingState, Day, SubscriptionView } from './subscriptions';

/*
 * PREVIEW ONLY ('mock' mode, never deployed): a company's subscription in each state, for the
 * company's Suscripción and the console's Cobros without a server. Built from today, so the dates
 * and the countdown always mean something.
 */

const DAY_MS = 86_400_000;
const addDays = (day: Day, days: number): Day => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** The plan the preview companies are on. */
export const PREVIEW_PLAN = {
  id: 'plan-team',
  name: 'Equipo',
  description: 'Para equipos que atienden varios números.',
  priceCents: 7900,
  discounts: { '1': 0, '3': 5, '6': 10, '12': 20 },
  benefits: ['Números de WhatsApp sin límite', 'Personas sin límite', 'Agente de ventas con IA'],
};

/** Every state but 'exempt': an exemption is separate from the subscription (mockup web-49). */
export function previewSubscription(today: Day, state: Exclude<BillingState, 'exempt'>): SubscriptionView {
  const plan = PREVIEW_PLAN;
  const first = state === 'awaiting_first_payment';
  const nextDueOn = { awaiting_first_payment: today, active: addDays(today, 20), due_soon: addDays(today, 5), grace: addDays(today, -1), suspended: addDays(today, -3), in_review: addDays(today, -1) }[state];
  const owes = state !== 'active';
  return {
    state,
    enforced: true,
    plan: { id: plan.id, name: plan.name, description: plan.description, priceCents: plan.priceCents, discounts: plan.discounts, benefits: plan.benefits },
    assignedAt: `${first ? today : addDays(today, -40)}T14:00:00.000Z`,
    origin: 'company',
    billingDay: first ? null : Number(nextDueOn.slice(8, 10)),
    nextDueOn,
    suspendsOn: addDays(nextDueOn, 3),
    owedCents: owes ? plan.priceCents : 0,
    charge: owes
      ? { id: 'charge-1', planName: plan.name, basePriceCents: plan.priceCents, discounts: plan.discounts, months: 1, discountPercent: 0, amountCents: plan.priceCents, paidCents: 0, dueOn: nextDueOn }
      : null,
    rate: { bsPerUsd: '410.55000000', effectiveDate: today },
    walletCents: state === 'active' ? 500 : 0,
    inReview:
      state === 'in_review'
        ? {
            id: 'payment-1',
            status: 'in_review',
            months: 1,
            methodId: 'method-pago-movil',
            methodName: 'Pago móvil',
            methodType: 'pago_movil',
            currency: 'VES',
            payer: { bank: '0102 · Banco de Venezuela', phone: '0414-1234567', document: 'V-18456789' },
            reference: '000451287',
            paidOn: today,
            amount: '32433.45',
            bsPerUsd: '410.55000000',
            amountUsdCents: plan.priceCents,
            hasProof: true,
            rejectionReason: null,
            rejectionNote: null,
            submittedAt: `${today}T15:00:00.000Z`,
            reviewedAt: null,
            receiptNumber: null,
          }
        : null,
  };
}

/** The preview's receipt image ('mock' mode only): a drawn bank receipt. */
export function previewProof(): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="460" viewBox="0 0 360 460">
  <rect width="360" height="460" fill="#f8fafc"/><rect x="40" y="40" width="280" height="380" rx="14" fill="#fff" stroke="#e5e7eb"/>
  <text x="60" y="90" font-family="Arial" font-size="18" font-weight="700" fill="#111827">Banco de Venezuela</text>
  <text x="60" y="120" font-family="Arial" font-size="14" fill="#059669">Pago móvil exitoso</text>
  <text x="60" y="170" font-family="Arial" font-size="13" fill="#374151">Referencia: 000451287</text>
  <text x="60" y="200" font-family="Arial" font-size="13" fill="#374151">Monto: Bs 32.433,45</text>
  <text x="60" y="230" font-family="Arial" font-size="13" fill="#374151">Destino: 0134 · Banesco</text>
  <text x="60" y="260" font-family="Arial" font-size="13" fill="#374151">Fecha: 09/10/2026 10:42</text></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}
