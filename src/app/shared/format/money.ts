// Money travels as integer cents (same rule as the backend) and is shown the Venezuelan way: "1.840 $".
const LOCALE = 'es-VE';

export function formatUsdCents(cents: number): string {
  const hasDecimals = cents % 100 !== 0;
  const amount = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `${amount} $`;
}

/** Meta per-message prices have three decimals: "0,011 $". */
export function formatUnitPrice(usd: number): string {
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 }).format(usd)} $`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

/** "7.049,00 Bs" */
export function formatVes(amount: number): string {
  return `${new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} Bs`;
}

/**
 * Reads prices the way people type them in Venezuela: "38", "38,50", "1.234,50", "$ 38.5".
 * Returns integer cents or null.
 */
export function parsePriceCents(text: string): number | null {
  let clean = text.replace(/[$\s]|US|USD/gi, '');
  if (!clean || !/^[\d.,]+$/.test(clean)) return null;
  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    clean = clean.replace(decimal === ',' ? /\./g : /,/g, '').replace(decimal, '.');
  } else if (lastComma >= 0) {
    clean = clean.replace(',', '.');
  } else if (lastDot >= 0 && clean.length - lastDot - 1 === 3) {
    clean = clean.replace(/\./g, ''); // "1.234" is thousands, not 1,234 dollars and cents
  }
  const value = Number(clean);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

/** An amount in a payment method's currency: "7.049,00 Bs", "12,50 $", "12,50 €". */
export function formatAmount(amount: number, currency: 'VES' | 'USD' | 'EUR'): string {
  if (currency === 'VES') return formatVes(amount);
  const text = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `${text} ${currency === 'USD' ? '$' : '€'}`;
}

/** An amount typed in any currency ("1.234,50 Bs", "20 $", "15€") as the server takes it: "1234.50". */
export function parseAmount(text: string): string | null {
  const cents = parsePriceCents(text.replace(/bs\.?|€/gi, ''));
  return cents === null ? null : (cents / 100).toFixed(2);
}
