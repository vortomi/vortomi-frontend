import type { Tone } from '../../../shared/api/models';
import { formatMonthName } from '../../../shared/format/date-time';
import type { BillingStatus, Day, PaymentMethod, PlanTerms, Subscription } from './subscription.models';

/** A fee due within these days shows as «Vence en N días». */
export const DUE_SOON_DAYS = 5;

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  mobile_payment: 'Pago móvil',
  transfer: 'Transferencia',
  zelle: 'Zelle',
  cash: 'Efectivo',
};

export const GRACE_OPTIONS = [3, 7, 15] as const;

// --- Calendar days (UTC math on "YYYY-MM-DD", so no time zone or summer time can shift a day). ---

const toUtc = (day: Day): number => Date.parse(`${day}T00:00:00Z`);
const fromUtc = (ms: number): Day => new Date(ms).toISOString().slice(0, 10);

export function addDays(day: Day, days: number): Day {
  return fromUtc(toUtc(day) + days * 86_400_000);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Day, to: Day): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** The billing day `months` months away, kept inside short months: 31 Jan + 1 → 28 Feb. */
export function shiftMonths(day: Day, billingDay: number, months: number): Day {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(billingDay, lastDay));
  return fromUtc(target.getTime());
}

export const nextMonthDay = (day: Day, billingDay: number): Day => shiftMonths(day, billingDay, 1);

/** "2026-11-10" → "2026-11", the month a fee due that day pays. */
export const monthOf = (day: Day): string => day.slice(0, 7);

// --- Status ---

export function billingStatus(sub: Subscription, today: Day): BillingStatus {
  if (sub.plan === 'internal') return 'free';
  if (sub.trialEndsOn && today <= sub.trialEndsOn) return 'trial';
  if (sub.nextChargeOn < today) return sub.graceUntil && today <= sub.graceUntil ? 'grace' : 'overdue';
  return daysBetween(today, sub.nextChargeOn) <= DUE_SOON_DAYS ? 'due_soon' : 'paid';
}

export interface StatusLabel {
  text: string;
  tone: Tone;
}

/** «Al día», «Vence en 3 días», «Atrasada 9 días»… with its colour. */
export function statusLabel(sub: Subscription, today: Day): StatusLabel {
  const status = billingStatus(sub, today);
  switch (status) {
    case 'free':
      return { text: 'Sin cobro', tone: 'neutral' };
    case 'trial': {
      const left = daysBetween(today, sub.trialEndsOn!);
      return { text: left === 0 ? 'Prueba gratis · termina hoy' : `Prueba gratis · ${plural(left, 'día')}`, tone: 'blue' };
    }
    case 'overdue':
      return { text: `Atrasada ${plural(daysBetween(sub.nextChargeOn, today), 'día')}`, tone: 'red' };
    case 'grace':
      return { text: `En gracia · ${plural(daysBetween(today, sub.graceUntil!), 'día')} más`, tone: 'amber' };
    case 'due_soon': {
      const left = daysBetween(today, sub.nextChargeOn);
      return { text: left === 0 ? 'Vence hoy' : `Vence en ${plural(left, 'día')}`, tone: 'amber' };
    }
    case 'paid':
      return { text: 'Al día', tone: 'green' };
  }
}

const plural = (n: number, word: string): string => `${n} ${n === 1 ? word : `${word}s`}`;

// --- Filters and figures ---

export type StatusFilter = 'all' | 'paid' | 'due_soon' | 'overdue' | 'trial';

/** Grace counts with the overdue ones: the money is still owed. */
export function matchesFilter(status: BillingStatus, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'overdue') return status === 'overdue' || status === 'grace';
  return status === filter;
}

export interface BillingFigures {
  /** What the paying companies are charged in a month. */
  monthlyCents: number;
  paying: number;
  /** Payments written down this calendar month. */
  collectedCents: number;
  collectedFrom: number;
  /** Fees overdue, in grace or due within DUE_SOON_DAYS. */
  owedCents: number;
  overdue: number;
  trials: number;
  /** Days left of the trial that ends first, or null without trials. */
  firstTrialEndsIn: number | null;
}

export function billingFigures(subs: Subscription[], plans: PlanTerms[], today: Day): BillingFigures {
  const price = (sub: Subscription) => plans.find((p) => p.plan === sub.plan)?.priceCents ?? 0;
  const month = monthOf(today);
  const statuses = subs.map((sub) => ({ sub, status: billingStatus(sub, today) }));
  const payingSubs = statuses.filter(({ status }) => status !== 'free' && status !== 'trial');
  const paidThisMonth = subs.filter((sub) => sub.payments.some((p) => monthOf(p.paidOn) === month));
  const owing = statuses.filter(({ status }) => status === 'overdue' || status === 'grace' || status === 'due_soon');
  const trialDays = statuses.filter(({ status }) => status === 'trial').map(({ sub }) => daysBetween(today, sub.trialEndsOn!));
  return {
    monthlyCents: payingSubs.reduce((sum, { sub }) => sum + price(sub), 0),
    paying: payingSubs.length,
    collectedCents: subs.flatMap((sub) => sub.payments).filter((p) => monthOf(p.paidOn) === month).reduce((sum, p) => sum + p.amountCents, 0),
    collectedFrom: paidThisMonth.length,
    owedCents: owing.reduce((sum, { sub }) => sum + price(sub), 0),
    overdue: statuses.filter(({ status }) => status === 'overdue' || status === 'grace').length,
    trials: trialDays.length,
    firstTrialEndsIn: trialDays.length ? Math.min(...trialDays) : null,
  };
}

/** «Noviembre», the month a payment covers. */
export function monthTitle(month: string): string {
  const name = formatMonthName(month);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Over the plan's limit: a plan change down must not leave the company with more than it allows. */
export function fitsPlan(sub: Pick<Subscription, 'usersUsed' | 'numbersUsed'>, terms: PlanTerms): boolean {
  return (terms.users === null || sub.usersUsed <= terms.users) && (terms.numbers === null || sub.numbersUsed <= terms.numbers);
}
