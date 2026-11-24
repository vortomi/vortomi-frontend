import type { Tone } from '../../../shared/api/models';
import type { BillingState, Day, SubscriptionRow } from '../../../shared/api/subscriptions';

export type RowState = SubscriptionRow['state'];
export type StateFilter = 'all' | RowState;

/** The filters of Cobros (mockup web-37, frame 4), in this order. */
export const STATE_FILTERS: { id: StateFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'awaiting_first_payment', label: 'Esperando 1er pago' },
  { id: 'active', label: 'Al día' },
  { id: 'due_soon', label: 'Por vencer' },
  { id: 'grace', label: 'En gracia' },
  { id: 'in_review', label: 'Pago en revisión' },
  { id: 'suspended', label: 'Suspendidas' },
  { id: 'none', label: 'Sin plan' },
];

const DAY_MS = 86_400_000;
const daysBetween = (from: Day, to: Day): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** «En gracia · 1 día»: the days of grace already gone, counting the due day's next one as the first. */
export function stateLabel(row: Pick<SubscriptionRow, 'state' | 'nextDueOn'>, today: Day): { text: string; tone: Tone } {
  switch (row.state) {
    case 'awaiting_first_payment':
      return { text: 'Esperando 1er pago', tone: 'amber' };
    case 'active':
      return { text: 'Al día', tone: 'green' };
    case 'due_soon':
      return { text: 'Por vencer', tone: 'amber' };
    case 'grace': {
      const days = row.nextDueOn ? daysBetween(row.nextDueOn, today) : 1;
      return { text: `En gracia · ${days} ${days === 1 ? 'día' : 'días'}`, tone: 'red' };
    }
    case 'suspended':
      return { text: 'Suspendida', tone: 'red' };
    case 'in_review':
      return { text: 'Pago en revisión', tone: 'blue' };
    case 'none':
      return { text: 'Sin plan', tone: 'neutral' };
  }
}

export interface BillingFigures {
  owedCents: number;
  awaiting: number;
  grace: number;
  suspended: number;
}

/** The four figures above the table. */
export function billingFigures(rows: SubscriptionRow[]): BillingFigures {
  const count = (state: BillingState) => rows.filter((r) => r.state === state).length;
  return {
    owedCents: rows.reduce((sum, r) => sum + r.owedCents, 0),
    awaiting: count('awaiting_first_payment'),
    grace: count('grace'),
    suspended: count('suspended'),
  };
}

/** What needs the team first: suspended, in grace, awaiting, a payment to review, due soon, up to date, without a plan. */
const ORDER: Record<RowState, number> = { suspended: 0, grace: 1, awaiting_first_payment: 2, in_review: 3, due_soon: 4, active: 5, none: 6 };

export function sortRows(rows: SubscriptionRow[]): SubscriptionRow[] {
  return [...rows].sort(
    (a, b) => ORDER[a.state] - ORDER[b.state] || (a.nextDueOn ?? '').localeCompare(b.nextDueOn ?? '') || a.tenantName.localeCompare(b.tenantName, 'es'),
  );
}

export const matchesFilter = (row: SubscriptionRow, filter: StateFilter): boolean => filter === 'all' || row.state === filter;

/** «3 dic», or «3 dic 2026» with the year. */
export function dayText(day: Day, year = false): string {
  return new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' })
    .format(new Date(`${day}T12:00:00Z`))
    .replace('.', '');
}
