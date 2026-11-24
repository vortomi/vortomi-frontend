import type { BillingState } from '../../shared/api/subscriptions';
import { PREVIEW_PLAN } from '../../shared/api/subscriptions.preview';
import type { CompanyPlan } from './subscription.models';

export { previewSubscription } from '../../shared/api/subscriptions.preview';

/*
 * PREVIEW ONLY ('mock' mode, never deployed): Vortomi's plans and a company's subscription, so the
 * screens can be reviewed without a server. «?estado=» picks what the subscription looks like:
 * awaiting_first_payment (default), active, due_soon, grace, suspended or none.
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

const STATES: readonly BillingState[] = ['awaiting_first_payment', 'active', 'due_soon', 'grace', 'suspended'];

/** The state «?estado=» asks for; null for «none» (a company without a plan). */
export function previewState(search: string): BillingState | null {
  const asked = new URLSearchParams(search).get('estado');
  if (asked === 'none') return null;
  return STATES.find((s) => s === asked) ?? 'awaiting_first_payment';
}
