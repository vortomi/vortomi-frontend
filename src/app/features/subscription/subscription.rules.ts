import type { BillingState, Day, PlanDiscounts, SubscriptionView } from '../../shared/api/subscriptions';
import type { Period } from './subscription.models';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Caracas has no summer time: always UTC-4. */
const CARACAS_OFFSET = '-04:00';

/** The moment a charge is due: 11:59 p. m. of its day, Caracas time. */
export const dueAt = (day: Day): Date => new Date(`${day}T23:59:00${CARACAS_OFFSET}`);

/** The moment an unpaid company is suspended: 00:00 of its day, Caracas time. */
export const suspensionAt = (day: Day): Date => new Date(`${day}T00:00:00${CARACAS_OFFSET}`);

/** «2026-12-21» for a moment, in Caracas. */
export function caracasDay(moment: Date): Day {
  return new Date(moment.getTime() - 4 * HOUR).toISOString().slice(0, 10);
}

export const addDays = (day: Day, days: number): Day => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** «3 dic», or «3 dic 2026» with the year. */
export function dayText(day: Day, year = false): string {
  return new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' })
    .format(new Date(`${day}T12:00:00Z`))
    .replace('.', '');
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  /** The moment already passed: the numbers count since then. */
  past: boolean;
}

export function countdown(now: Date, target: Date): Countdown {
  const diff = target.getTime() - now.getTime();
  const left = Math.abs(diff);
  return {
    days: Math.floor(left / DAY),
    hours: Math.floor((left % DAY) / HOUR),
    minutes: Math.floor((left % HOUR) / MINUTE),
    past: diff < 0,
  };
}

/** What the countdown aims at: the suspension while something is overdue or unpaid, else the next due day. */
export function countdownTarget(s: Pick<SubscriptionView, 'state' | 'nextDueOn' | 'suspendsOn'>): { at: Date; suspension: boolean } {
  const suspension = s.state === 'awaiting_first_payment' || s.state === 'grace' || s.state === 'suspended';
  return suspension ? { at: suspensionAt(s.suspendsOn), suspension } : { at: dueAt(s.nextDueOn), suspension };
}

export type Tone = 'ok' | 'soon' | 'overdue';

/** The colour of each state: amber while there is still time, red once it is overdue. */
export const STATE_TONE: Record<BillingState, Tone> = {
  awaiting_first_payment: 'soon',
  active: 'ok',
  due_soon: 'soon',
  grace: 'overdue',
  suspended: 'overdue',
};

export const STATE_TEXT: Record<BillingState, string> = {
  awaiting_first_payment: 'Esperando tu primer pago',
  active: 'Al día',
  due_soon: 'Por vencer',
  grace: 'Vencido',
  suspended: 'Suspendida',
};

/** The last day to pay without being suspended. */
export const lastPayDay = (s: Pick<SubscriptionView, 'suspendsOn'>): Day => addDays(s.suspendsOn, -1);

/** Whole days from today to a day (0 today, negative once passed). */
const daysUntil = (today: Day, day: Day): number => Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);

/** The menu's short count: «2 d», «Hoy», «!»; nothing while the company is up to date. */
export function subscriptionBadge(s: SubscriptionView, today: Day): string | null {
  if (s.state === 'active') return null;
  if (s.state === 'grace' || s.state === 'suspended') return '!';
  const days = daysUntil(today, s.state === 'awaiting_first_payment' ? lastPayDay(s) : s.nextDueOn);
  return days <= 0 ? 'Hoy' : `${days} d`;
}

export interface Notice {
  tone: Exclude<Tone, 'ok'>;
  title: string;
  detail: string;
  /** A company locked out cannot hide it: it is the way out. */
  dismissable: boolean;
}

/** The banner above every panel screen (mockup web-37, frames 5 and 6); null while up to date. */
export function subscriptionNotice(s: SubscriptionView, money: (cents: number) => string): Notice | null {
  const owed = money(s.owedCents);
  switch (s.state) {
    case 'active':
      return null;
    case 'awaiting_first_payment':
      return {
        tone: 'soon',
        title: `Haz tu primer pago antes del ${dayText(lastPayDay(s))}.`,
        detail: `Si no, el ${dayText(s.suspendsOn)} tu cuenta se suspende.`,
        dismissable: true,
      };
    case 'due_soon':
      return { tone: 'soon', title: `Tu plan ${s.plan.name} vence el ${dayText(s.nextDueOn)}.`, detail: 'Paga a tiempo para que el bot siga respondiendo.', dismissable: true };
    case 'grace':
      return {
        tone: 'overdue',
        title: `Tu plan venció el ${dayText(s.nextDueOn)}. Debes ${owed}.`,
        detail: `Paga antes del ${dayText(s.suspendsOn)} o tu cuenta se suspende.`,
        dismissable: true,
      };
    case 'suspended':
      return s.enforced
        ? { tone: 'overdue', title: 'Tu cuenta está suspendida por falta de pago.', detail: `Debes ${owed}.`, dismissable: false }
        : { tone: 'overdue', title: `Tu pago está vencido desde el ${dayText(s.nextDueOn)}.`, detail: `Debes ${owed}.`, dismissable: true };
  }
}

export interface PeriodPrice {
  discountPercent: number;
  /** What a month comes to with the discount. */
  monthlyCents: number;
  totalCents: number;
  savedCents: number;
}

/** A price paid for `months`: its discount applies to the base price of every month. */
export function priceFor(price: { priceCents: number; discounts: PlanDiscounts }, months: Period): PeriodPrice {
  const discountPercent = price.discounts[String(months) as keyof PlanDiscounts] ?? 0;
  const fullCents = price.priceCents * months;
  const totalCents = Math.round((fullCents * (100 - discountPercent)) / 100);
  return { discountPercent, totalCents, monthlyCents: Math.round(totalCents / months), savedCents: fullCents - totalCents };
}

/**
 * What the company pays now for `months`: the charge's own price and discounts (fixed when it was
 * made), less what it already paid of it. Without a charge (nothing owed), the plan's price today.
 */
export function amountToPay(s: Pick<SubscriptionView, 'plan' | 'charge'>, months: Period): PeriodPrice & { dueCents: number } {
  const source = s.charge ? { priceCents: s.charge.basePriceCents, discounts: s.charge.discounts } : s.plan;
  const price = priceFor(source, months);
  return { ...price, dueCents: Math.max(0, price.totalCents - (s.charge?.paidCents ?? 0)) };
}

/** Dollars in bolívares at Vortomi's rate, rounded to the céntimo. */
export function inBolivares(cents: number, bsPerUsd: string): number {
  return Math.round((cents / 100) * Number(bsPerUsd) * 100) / 100;
}

export interface SubscriptionEvent {
  on: Day;
  kind: 'assigned' | 'due' | 'suspension';
  title: string;
  detail: string;
}

/** On the same day, what comes later in the story goes first. */
const EVENT_ORDER: Record<SubscriptionEvent['kind'], number> = { suspension: 0, due: 1, assigned: 2 };

/** «Tu suscripción en el tiempo», from its real dates: newest first. */
export function subscriptionEvents(s: SubscriptionView, money: (cents: number) => string): SubscriptionEvent[] {
  const events: SubscriptionEvent[] = [
    { on: caracasDay(new Date(s.assignedAt)), kind: 'assigned', title: `Plan ${s.plan.name} asignado`, detail: `${money(s.plan.priceCents)} al mes` },
  ];
  if (s.owedCents > 0) {
    events.push({
      on: s.nextDueOn,
      kind: 'due',
      title: s.billingDay === null ? 'Tu primer pago' : 'Tu próximo pago',
      detail: `${money(s.owedCents)} · elige 1, 3, 6 o 12 meses al pagar`,
    });
    events.push({ on: s.suspendsOn, kind: 'suspension', title: 'Se suspende si no pagas', detail: 'A las 12:00 a. m. Tus mensajes se guardan; el bot deja de responder.' });
  } else {
    events.push({ on: s.nextDueOn, kind: 'due', title: 'Tu próximo pago', detail: `Desde ${money(s.plan.priceCents)} al mes` });
  }
  return events.sort((a, b) => b.on.localeCompare(a.on) || EVENT_ORDER[a.kind] - EVENT_ORDER[b.kind]);
}
