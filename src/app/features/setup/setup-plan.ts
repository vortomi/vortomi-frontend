// The welcome's summary (block C): each part of the plan as one line with what it adds.
import { SALE_UNIT } from '../inventory/sale-units';
import { PART_LABEL, type PlanItem, type PlanPart, type SetupPlan } from './setup.models';

/** A part of the plan as the summary shows it: one line, a checkbox. */
export interface PlanLine {
  part: PlanPart;
  label: string;
  /** What it adds; empty when everything is already there. */
  adds: string;
  /** What the company already has, left as it is. */
  keeps: string;
}

const LIST_LIMIT = 6;

/** The plan's parts in order; a list longer than six ends in "y N más". */
export function planLines(plan: SetupPlan): PlanLine[] {
  const list = (items: PlanItem[]) => {
    const fresh = items.filter((i) => !i.exists).map((i) => (i.detail ? `${i.name} (${i.detail})` : i.name));
    return fresh.length > LIST_LIMIT ? `${fresh.slice(0, LIST_LIMIT).join(', ')} y ${fresh.length - LIST_LIMIT} más` : fresh.join(', ');
  };
  const kept = (items: PlanItem[]) => items.filter((i) => i.exists).map((i) => i.name).join(', ');
  const lines: PlanLine[] = [];
  if (plan.workMode) lines.push({ part: 'workMode', label: PART_LABEL.workMode, adds: 'Solo atención: se ocultan el inventario y el pipeline', keeps: '' });
  if (plan.saleDefaults) {
    const unit = SALE_UNIT[plan.saleDefaults.defaultSaleUnit].label.toLowerCase();
    const stock = plan.saleDefaults.defaultStockMode === 'availability' ? 'con «disponible hoy», sin contar existencias' : 'contando existencias';
    lines.push({ part: 'saleDefaults', label: PART_LABEL.saleDefaults, adds: `Se venden por ${unit}, ${stock}`, keeps: '' });
  }
  const parts: [PlanPart, PlanItem[]][] = [
    ['categories', plan.categories],
    ['productFields', plan.productFields],
    ['contactFields', plan.contactFields],
    ['variantTypes', plan.variantTypes],
    ['tags', plan.tags],
  ];
  for (const [part, items] of parts) {
    if (items.length) lines.push({ part, label: PART_LABEL[part], adds: list(items), keeps: kept(items) });
  }
  return lines;
}
