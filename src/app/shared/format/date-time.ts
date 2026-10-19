// Dates are always shown in the tenant's time zone, never the browser's:
// an agent travelling abroad must see the same times as the rest of the team.
import type { IsoDate } from '../api/models';

const DAY_MS = 86_400_000;
const LOCALE = 'es-VE';

const dayKey = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export type RelativeDay = 'today' | 'yesterday' | 'older';

export function relativeDay(iso: IsoDate, now: Date, timeZone: string): RelativeDay {
  const key = dayKey(new Date(iso), timeZone);
  if (key === dayKey(now, timeZone)) return 'today';
  if (key === dayKey(new Date(now.getTime() - DAY_MS), timeZone)) return 'yesterday';
  return 'older';
}

/** "10:21" */
export function formatTime(iso: IsoDate, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso),
  );
}

/** Conversation list stamp: "10:21", "Ayer" or "6 oct". */
export function formatListStamp(iso: IsoDate, now: Date, timeZone: string): string {
  switch (relativeDay(iso, now, timeZone)) {
    case 'today':
      return formatTime(iso, timeZone);
    case 'yesterday':
      return 'Ayer';
    default:
      return new Intl.DateTimeFormat(LOCALE, { timeZone, day: 'numeric', month: 'short' })
        .format(new Date(iso))
        .replace('.', '');
  }
}

/** Chat day separator: "Hoy", "Ayer" or "6 de octubre". */
export function formatDayLabel(iso: IsoDate, now: Date, timeZone: string): string {
  switch (relativeDay(iso, now, timeZone)) {
    case 'today':
      return 'Hoy';
    case 'yesterday':
      return 'Ayer';
    default:
      return new Intl.DateTimeFormat(LOCALE, { timeZone, day: 'numeric', month: 'long' }).format(new Date(iso));
  }
}

/** "marzo de 2026" */
export function formatMonthYear(iso: IsoDate, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, month: 'long', year: 'numeric' }).format(new Date(iso));
}

/** "4 ago 2026" */
export function formatShortDate(iso: IsoDate, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(iso))
    .replace('.', '');
}

/** Billing month "2026-10" → "octubre". */
export function formatMonthName(yearMonth: string): string {
  return new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' }).format(new Date(`${yearMonth}-01T12:00:00Z`));
}

/** Calendar day in the tenant's zone, used to group messages. */
export function calendarDay(iso: IsoDate, timeZone: string): string {
  return dayKey(new Date(iso), timeZone);
}

/** Calendar day "2026-10-01" → "Jue 1", for chart axes. */
export function formatWeekdayDay(day: string): string {
  const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${day}T12:00:00Z`))
    .replace('.', '');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${Number(day.slice(8, 10))}`;
}
