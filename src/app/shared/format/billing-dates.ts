/** The due day `months` after `day`, on the billing day (31 → 28 in February). Same as the server. */
export function addMonthsOn(day: string, months: number, billingDay: number): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7)) - 1 + months;
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(billingDay, last));
  return first.toISOString().slice(0, 10);
}

/** «26 de noviembre», or «24 de noviembre de 2027» with the year (Caracas calendar). */
export function longDay(day: string, year = false): string {
  return new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );
}
