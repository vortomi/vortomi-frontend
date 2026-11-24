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

export function previewSubscription(today: Day, state: BillingState): SubscriptionView {
  const plan = PREVIEW_PLAN;
  const first = state === 'awaiting_first_payment';
  const nextDueOn = { awaiting_first_payment: today, active: addDays(today, 20), due_soon: addDays(today, 5), grace: addDays(today, -1), suspended: addDays(today, -3) }[state];
  const owes = state !== 'active';
  return {
    state,
    enforced: true,
    plan: { id: plan.id, name: plan.name, description: plan.description, priceCents: plan.priceCents, discounts: plan.discounts, benefits: plan.benefits },
    assignedAt: `${first ? today : addDays(today, -40)}T14:00:00.000Z`,
    billingDay: first ? null : Number(nextDueOn.slice(8, 10)),
    nextDueOn,
    suspendsOn: addDays(nextDueOn, 3),
    owedCents: owes ? plan.priceCents : 0,
    charge: owes
      ? { id: 'charge-1', planName: plan.name, basePriceCents: plan.priceCents, discounts: plan.discounts, months: 1, discountPercent: 0, amountCents: plan.priceCents, paidCents: 0, dueOn: nextDueOn }
      : null,
    rate: { bsPerUsd: '410.55000000', effectiveDate: today },
  };
}
