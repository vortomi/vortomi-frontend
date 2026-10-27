// How rates are typed and read in the panel. Values stay strings ("886.2271") until shown:
// no floating point on the way to the server.

const LOCALE = 'es-VE';
const RATE_FORMAT = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
const WEEKDAY_FORMAT = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', timeZone: 'UTC' });

/** Bolívares per dollar as typed: "Bs 36,52" → "36.52"; up to 8 decimals; null when not a positive amount. */
export function normalizeRate(raw: string): string | null {
  const value = raw
    .trim()
    .replace(/^Bs\.?\s*/i, '')
    .replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,8})?$/.test(value)) return null;
  return Number(value) > 0 ? value : null;
}

/** "887.30200000" → "Bs 887,302". */
export function formatRate(value: string): string {
  return `Bs ${RATE_FORMAT.format(Number(value))}`;
}

/** "2026-10-05" → "05/10/2026". */
export function formatIsoDay(value: string): string {
  return value.split('-').reverse().join('/');
}

/** "2026-10-27" → "martes". */
export function weekdayOf(value: string): string {
  return WEEKDAY_FORMAT.format(new Date(`${value}T12:00:00Z`));
}
