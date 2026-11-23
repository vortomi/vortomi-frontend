import type { CompanyPlan, Day, Period, SubscriptionPayment } from './subscription.models';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Reminders start this many days before the plan is due (mockup web-35, step 2). */
export const REMINDER_DAYS = 7;

/** Caracas has no summer time: always UTC-4. */
const CARACAS_OFFSET = '-04:00';

/** The moment the plan is due: 11:59 p. m. of its last day, Caracas time. */
export const dueAt = (endsOn: Day): Date => new Date(`${endsOn}T23:59:00${CARACAS_OFFSET}`);

/** «2026-12-21» for a moment, in Caracas. */
export function caracasDay(moment: Date): Day {
  return new Date(moment.getTime() - 4 * HOUR).toISOString().slice(0, 10);
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  /** The moment already passed: the numbers count since then. */
  past: boolean;
}

export function countdown(now: Date, due: Date): Countdown {
  const diff = due.getTime() - now.getTime();
  const left = Math.abs(diff);
  return {
    days: Math.floor(left / DAY),
    hours: Math.floor((left % DAY) / HOUR),
    minutes: Math.floor((left % HOUR) / MINUTE),
    past: diff < 0,
  };
}

export type ReminderLevel = 'ok' | 'soon' | 'overdue';

export interface Reminder {
  level: ReminderLevel;
  /** Whole days left (soon) or since it was due (overdue). */
  days: number;
}

/** Up to date, due within REMINDER_DAYS, or overdue. */
export function reminderOf(now: Date, due: Date): Reminder {
  const diff = due.getTime() - now.getTime();
  if (diff < 0) return { level: 'overdue', days: Math.floor(-diff / DAY) };
  const days = Math.floor(diff / DAY);
  return { level: days < REMINDER_DAYS ? 'soon' : 'ok', days };
}

/** «Vence en 6 días», «Vence hoy», «Venció hace 2 días». */
export function reminderText(reminder: Reminder): string {
  if (reminder.level === 'overdue') return reminder.days === 0 ? 'Venció hoy' : `Venció hace ${plural(reminder.days, 'día')}`;
  return reminder.days === 0 ? 'Vence hoy' : `Vence en ${plural(reminder.days, 'día')}`;
}

/** The menu's short count: «6 d», «Hoy», «!». */
export function reminderBadge(reminder: Reminder): string | null {
  if (reminder.level === 'ok') return null;
  if (reminder.level === 'overdue') return '!';
  return reminder.days === 0 ? 'Hoy' : `${reminder.days} d`;
}

const toUtc = (day: Day): number => Date.parse(`${day}T00:00:00Z`);

/** How much of the period paid already went by. */
export function periodProgress(startsOn: Day, endsOn: Day, today: Day): { elapsed: number; total: number; percent: number } {
  const total = Math.max(1, Math.round((toUtc(endsOn) - toUtc(startsOn)) / DAY));
  const elapsed = Math.min(total, Math.max(0, Math.round((toUtc(today) - toUtc(startsOn)) / DAY)));
  return { elapsed, total, percent: Math.round((elapsed / total) * 100) };
}

export interface PeriodPrice {
  discountPercent: number;
  /** What a month comes to with the discount. */
  monthlyCents: number;
  totalCents: number;
  savedCents: number;
}

/** A plan paid for `months`: its discount applies to the base price of every month. */
export function priceFor(plan: Pick<CompanyPlan, 'priceCents' | 'discounts'>, months: Period): PeriodPrice {
  const discountPercent = plan.discounts[String(months) as keyof CompanyPlan['discounts']] ?? 0;
  const fullCents = plan.priceCents * months;
  const totalCents = Math.round((fullCents * (100 - discountPercent)) / 100);
  return { discountPercent, totalCents, monthlyCents: Math.round(totalCents / months), savedCents: fullCents - totalCents };
}

export interface YearTotals {
  paidCents: number;
  payments: number;
  savedCents: number;
}

/** What the approved payments of `year` add up to, and what their discounts saved. */
export function yearTotals(payments: SubscriptionPayment[], year: string): YearTotals {
  const approved = payments.filter((p) => p.status === 'approved' && p.paidOn.startsWith(year));
  return {
    paidCents: approved.reduce((sum, p) => sum + p.amountCents, 0),
    payments: approved.length,
    savedCents: approved.reduce((sum, p) => sum + savedBy(p), 0),
  };
}

/** What a payment saved: the full price it would have been without its discount. */
export function savedBy(payment: SubscriptionPayment): number {
  if (!payment.discountPercent) return 0;
  return Math.round((payment.amountCents * 100) / (100 - payment.discountPercent)) - payment.amountCents;
}

export interface TimelineBar {
  label: string;
  plan: string;
  /** Percent from the left and width, within the months shown. */
  left: number;
  width: number;
  current: boolean;
}

/** The months the timeline shows («may» … «dic») and where each paid period sits in them. */
export function timeline(payments: SubscriptionPayment[], until: Day, today: Day): { months: string[]; bars: TimelineBar[]; todayAt: number } {
  const first = payments.length ? payments[payments.length - 1]!.from : today;
  const start = `${first.slice(0, 7)}-01`;
  const endMonth = new Date(`${until.slice(0, 7)}-01T00:00:00Z`);
  endMonth.setUTCMonth(endMonth.getUTCMonth() + 1);
  const end = endMonth.toISOString().slice(0, 10);
  const span = toUtc(end) - toUtc(start);
  const at = (day: Day) => Math.min(100, Math.max(0, ((toUtc(day) - toUtc(start)) / span) * 100));
  const months: string[] = [];
  for (const cursor = new Date(`${start}T00:00:00Z`); cursor.toISOString().slice(0, 10) < end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    months.push(new Intl.DateTimeFormat('es-VE', { month: 'short', timeZone: 'UTC' }).format(cursor).replace('.', ''));
  }
  const bars = [...payments].reverse().map((p) => ({
    label: `${p.planName}${p.months > 1 ? ` · ${p.months} meses` : ''}`,
    plan: p.planName,
    left: at(p.from),
    width: Math.max(2, at(p.to) - at(p.from)),
    current: p.from <= today && today < p.to,
  }));
  return { months, bars, todayAt: at(today) };
}

const plural = (n: number, word: string): string => `${n} ${n === 1 ? word : `${word}s`}`;
