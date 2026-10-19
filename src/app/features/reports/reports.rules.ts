// Pure report rules: periods, totals per day and per person, and the comparison with the period before.
// Days are calendar days in the company's time zone ("2026-10-09"), so the arithmetic runs in UTC.
import type { Id, ReportDay } from '../../shared/api/models';

export type ReportPeriod = 'last7' | 'month' | 'previousMonth';

/** Inclusive range of calendar days. */
export interface DayRange {
  from: string;
  to: string;
}

export interface Totals {
  conversations: number;
  onTime: number;
  /** Median seconds to the first reply, or null when nothing was answered. */
  medianSec: number | null;
  wonCount: number;
  wonCents: number;
}

export interface DayBar {
  date: string;
  conversations: number;
  onTime: number;
}

const DAY_MS = 86_400_000;

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (day: string, days: number) => toDay(new Date(toDate(day).getTime() + days * DAY_MS));
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
/** Last day of the month before the one `day` belongs to. */
const endOfPreviousMonth = (day: string) => addDays(monthStart(day), -1);

export function periodRange(period: ReportPeriod, today: string): DayRange {
  switch (period) {
    case 'last7':
      return { from: addDays(today, -6), to: today };
    case 'month':
      return { from: monthStart(today), to: today };
    case 'previousMonth': {
      const to = endOfPreviousMonth(today);
      return { from: monthStart(to), to };
    }
  }
}

/** Range to compare against: same length right before, or the same stretch of the previous month. */
export function comparisonRange(period: ReportPeriod, today: string): DayRange {
  switch (period) {
    case 'last7':
      return { from: addDays(today, -13), to: addDays(today, -7) };
    case 'month': {
      const lastOfPrevious = endOfPreviousMonth(today);
      const day = Math.min(Number(today.slice(8, 10)), Number(lastOfPrevious.slice(8, 10)));
      return { from: monthStart(lastOfPrevious), to: `${lastOfPrevious.slice(0, 8)}${String(day).padStart(2, '0')}` };
    }
    case 'previousMonth':
      return periodRange('previousMonth', endOfPreviousMonth(today));
  }
}

export function daysOf(range: DayRange): string[] {
  const days: string[] = [];
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) days.push(day);
  return days;
}

export const inRange = (rows: readonly ReportDay[], range: DayRange): ReportDay[] =>
  rows.filter((row) => row.date >= range.from && row.date <= range.to);

/**
 * Median of the daily medians, weighted by conversations. Approximation for the prototype:
 * the backend computes the exact median over every first reply (percentile_cont).
 */
export function weightedMedian(points: readonly { value: number; weight: number }[]): number | null {
  const sorted = points.filter((p) => p.weight > 0).sort((a, b) => a.value - b.value);
  const half = sorted.reduce((sum, p) => sum + p.weight, 0) / 2;
  let seen = 0;
  for (const point of sorted) {
    seen += point.weight;
    if (seen >= half) return point.value;
  }
  return null;
}

export function summarize(rows: readonly ReportDay[]): Totals {
  const sum = (pick: (row: ReportDay) => number) => rows.reduce((total, row) => total + pick(row), 0);
  return {
    conversations: sum((r) => r.conversations),
    onTime: sum((r) => r.onTime),
    medianSec: weightedMedian(
      rows.flatMap((r) => (r.firstResponseMedianSec === null ? [] : [{ value: r.firstResponseMedianSec, weight: r.conversations }])),
    ),
    wonCount: sum((r) => r.wonCount),
    wonCents: sum((r) => r.wonCents),
  };
}

/** One bar per calendar day of the range, zero on days without activity. */
export function byDay(rows: readonly ReportDay[], range: DayRange): DayBar[] {
  const totals = new Map<string, DayBar>(daysOf(range).map((date) => [date, { date, conversations: 0, onTime: 0 }]));
  for (const row of rows) {
    const bar = totals.get(row.date);
    if (!bar) continue;
    bar.conversations += row.conversations;
    bar.onTime += row.onTime;
  }
  return [...totals.values()];
}

/** Totals per person; the null key gathers the conversations nobody answered. */
export function byPerson(rows: readonly ReportDay[]): Map<Id | null, Totals> {
  const groups = new Map<Id | null, ReportDay[]>();
  for (const row of rows) {
    const own = groups.get(row.userId);
    if (own) own.push(row);
    else groups.set(row.userId, [row]);
  }
  return new Map([...groups].map(([userId, own]) => [userId, summarize(own)]));
}

/** Whole percent change, or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

export const onTimeRate = (totals: Totals): number =>
  totals.conversations ? Math.round((totals.onTime / totals.conversations) * 100) : 0;
