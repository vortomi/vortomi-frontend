import { formatUsdCents } from '../../../shared/format/money';
import { MAX_BENEFITS, MAX_DISCOUNT, PERIOD_LABEL, PLAN_PERIODS, type Plan, type PlanInput } from './plan.models';

/** What the form holds: the price and discounts as typed. */
export interface PlanDraft {
  name: string;
  description: string;
  price: string;
  discounts: Record<string, string>;
  benefits: string[];
  isActive: boolean;
}

export const EMPTY_DRAFT: PlanDraft = {
  name: '',
  description: '',
  price: '',
  discounts: { '1': '0', '3': '0', '6': '0', '12': '0' },
  benefits: [],
  isActive: true,
};

/** "79,00" for the price field. */
export const priceText = (cents: number): string => formatUsdCents(cents).replace(' $', '');

export function draftOf(plan: Plan): PlanDraft {
  return {
    name: plan.name,
    description: plan.description,
    price: priceText(plan.priceCents),
    discounts: Object.fromEntries(PLAN_PERIODS.map((p) => [p, String(plan.discounts[p])])),
    benefits: [...plan.benefits],
    isActive: plan.isActive,
  };
}

/** A whole percent from 0 to MAX_DISCOUNT, or null. */
export function percentOf(text: string): number | null {
  const clean = text.trim() || '0';
  if (!/^\d{1,3}$/.test(clean)) return null;
  const value = Number(clean);
  return value <= MAX_DISCOUNT ? value : null;
}

/**
 * The plan to send, or what to fix first in plain words. `parsePrice` reads the price the
 * Venezuelan way (shared/format/money); `takenNames` are the other plans' names.
 */
export function readDraft(
  draft: PlanDraft,
  parsePrice: (text: string) => number | null,
  takenNames: string[],
): { input: PlanInput } | { problem: string } {
  const name = draft.name.trim();
  if (name.length < 2) return { problem: 'Escribe el nombre del plan.' };
  if (takenNames.some((n) => n.trim().toLowerCase() === name.toLowerCase())) return { problem: `Ya existe un plan llamado «${name}». Usa otro nombre.` };
  const priceCents = parsePrice(draft.price);
  if (!priceCents || priceCents <= 0) return { problem: 'Escribe un precio base mayor que cero.' };
  const discounts = {} as PlanInput['discounts'];
  for (const period of PLAN_PERIODS) {
    const value = percentOf(draft.discounts[period] ?? '');
    if (value === null) return { problem: `El descuento de ${PERIOD_LABEL[period]} debe ser un número entero del 0 al ${MAX_DISCOUNT} %.` };
    discounts[period] = value;
  }
  const benefits = draft.benefits.map((b) => b.trim()).filter(Boolean);
  if (benefits.length > MAX_BENEFITS) return { problem: `Un plan tiene hasta ${MAX_BENEFITS} beneficios.` };
  return { input: { name, description: draft.description.trim(), priceCents, discounts, benefits } };
}

/** What an edit changes, said for the confirmation («Precio base: 79,00 $ → 89,00 $»). */
export function changesOf(before: Plan, after: PlanInput): string[] {
  const changes: string[] = [];
  if (before.name !== after.name) changes.push(`Nombre: ${before.name} → ${after.name}`);
  if (before.priceCents !== after.priceCents) changes.push(`Precio base: ${formatUsdCents(before.priceCents)} → ${formatUsdCents(after.priceCents)} al mes`);
  for (const period of PLAN_PERIODS) {
    if (before.discounts[period] !== after.discounts[period]) changes.push(`Descuento de ${PERIOD_LABEL[period]}: ${before.discounts[period]} % → ${after.discounts[period]} %`);
  }
  if (before.description !== after.description) changes.push('Descripción');
  if (before.benefits.join('\n') !== after.benefits.join('\n')) changes.push('Beneficios');
  return changes;
}

/** Price or discounts changed: what the companies on the plan will pay from their next invoice. */
export const changesWhatTheyPay = (before: Plan, after: PlanInput): boolean =>
  before.priceCents !== after.priceCents || PLAN_PERIODS.some((p) => before.discounts[p] !== after.discounts[p]);

export const companiesText = (n: number): string => (n === 0 ? 'Ninguna empresa' : n === 1 ? '1 empresa' : `${n} empresas`);
