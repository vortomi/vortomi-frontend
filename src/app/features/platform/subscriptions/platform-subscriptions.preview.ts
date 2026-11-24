import type { Day, IncomeBucket, PaymentHistory, RecentPayment, SubscriptionRow, SubscriptionSummary, SummaryPeriod } from '../../../shared/api/subscriptions';
import { addDays } from './billing.rules';

/*
 * PREVIEW ONLY ('mock' mode, never deployed): approved payments to Vortomi, so Suscripciones →
 * Resumen (mockup web-51) and a company's history can be reviewed without a server. The summary is
 * computed from them the way the server does, so the period filter works here too.
 */

interface PreviewPayment extends RecentPayment {
  coversTo: Day;
}

const RATE = 410.55;

function previewPayments(today: Day, rows: SubscriptionRow[]): PreviewPayment[] {
  const [first, second, third] = rows;
  if (!first) return [];
  const pay = (n: number, row: SubscriptionRow, daysAgo: number, cents: number, months: number, methodName: string, currency: 'USD' | 'VES'): PreviewPayment => ({
    id: `preview-paid-${n}`,
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    planName: row.planName ?? 'Equipo',
    months,
    paidOn: addDays(today, -daysAgo),
    methodName,
    reference: currency === 'VES' ? `00045${1280 + n}` : `ZX${10000 + n}`,
    currency,
    receivedCents: cents,
    receivedAmount: currency === 'VES' ? ((cents / 100) * RATE).toFixed(2) : (cents / 100).toFixed(2),
    receiptNumber: n,
    coversTo: addDays(today, 30 * months - daysAgo),
  });
  return [
    pay(1, second ?? first, 70, 13500, 1, 'Zelle', 'USD'),
    pay(2, third ?? first, 40, 31000, 3, 'Transferencia', 'VES'),
    pay(3, first, 2, 13500, 1, 'Pago móvil', 'VES'),
    pay(4, first, 1, 40500, 3, 'Pago móvil', 'VES'),
  ];
}

const firstOfMonth = (day: Day): Day => `${day.slice(0, 7)}-01`;
const monthsBack = (day: Day, months: number): Day =>
  new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1 - months, 1)).toISOString().slice(0, 10);

function periodStart(period: SummaryPeriod, today: Day, firstPaidOn: Day | null): Day {
  if (period === 'month') return firstOfMonth(today);
  if (period === 'year') return `${today.slice(0, 4)}-01-01`;
  if (period === '12m') return monthsBack(today, 11);
  return firstOfMonth(firstPaidOn && firstPaidOn < today ? firstPaidOn : today);
}

function bucketKeys(period: SummaryPeriod, from: Day, today: Day): string[] {
  if (period === 'month') {
    const end = addDays(monthsBack(today, -1), -1);
    const keys: string[] = [];
    for (let d = from; d <= end; d = addDays(d, 1)) keys.push(d);
    return keys;
  }
  const end = period === 'year' ? `${today.slice(0, 4)}-12-01` : firstOfMonth(today);
  const keys: string[] = [];
  for (let m = firstOfMonth(from); m <= end; m = monthsBack(m, -1)) keys.push(m.slice(0, 7));
  return keys;
}

/** What GET /platform/subscriptions/summary would answer for these rows (Cobros). */
export function previewSummary(today: Day, period: SummaryPeriod, rows: SubscriptionRow[]): SubscriptionSummary {
  const payments = previewPayments(today, rows);
  const firstPaidOn = payments.reduce<Day | null>((min, p) => (!min || p.paidOn < min ? p.paidOn : min), null);
  const from = periodStart(period, today, firstPaidOn);
  const inPeriod = payments.filter((p) => p.paidOn >= from && p.paidOn <= today);
  const sum = (list: PreviewPayment[]) => list.reduce((s, p) => s + p.receivedCents, 0);
  const ves = (list: PreviewPayment[]) => list.filter((p) => p.currency === 'VES').reduce((s, p) => s + Number(p.receivedAmount), 0).toFixed(2);
  const thisMonth = firstOfMonth(today);
  const prevFrom = monthsBack(today, 1);
  const buckets: IncomeBucket[] = bucketKeys(period, from, today).map((key) => {
    const matching = inPeriod.filter((p) => p.paidOn.startsWith(key));
    return { key, cents: sum(matching), count: matching.length };
  });
  const methods = new Map<string, PreviewPayment[]>();
  for (const p of inPeriod) methods.set(p.methodName, [...(methods.get(p.methodName) ?? []), p]);
  const overdue = rows.filter((r) => r.state === 'grace' || r.state === 'suspended');
  const count = (states: string[]) => rows.filter((r) => states.includes(r.state)).length;
  return {
    period: { id: period, from, to: today },
    income: {
      thisMonthCents: sum(payments.filter((p) => p.paidOn >= thisMonth)),
      previousMonthCents: sum(payments.filter((p) => p.paidOn >= prevFrom && p.paidOn < thisMonth)),
      periodCents: sum(inPeriod),
      periodVes: ves(inPeriod),
      periodCount: inPeriod.length,
      firstPaidOn,
    },
    recurringCents: 13500 + 10333 + 13500,
    owedCents: rows.reduce((s, r) => s + (r.state === 'exempt' ? 0 : r.owedCents), 0),
    overdueCents: overdue.reduce((s, r) => s + r.owedCents, 0),
    overdueCompanies: overdue.length,
    companies: {
      upToDate: count(['active', 'due_soon', 'in_review']),
      awaitingFirst: count(['awaiting_first_payment']),
      overdue: overdue.length,
      exempt: count(['exempt']),
      trial: Math.min(2, count(['none'])),
      noPlan: Math.max(0, count(['none']) - 2),
    },
    walletCents: 500,
    review: { count: 2, cents: 27515 },
    buckets,
    byMethod: [...methods.entries()]
      .map(([methodName, list]) => ({ methodName, currency: list[0]!.currency, cents: sum(list), ves: ves(list), count: list.length }))
      .sort((a, b) => b.cents - a.cents),
    upcoming: rows
      .filter((r) => r.nextDueOn && r.state !== 'exempt' && r.nextDueOn >= today && r.nextDueOn <= addDays(today, 30))
      .map((r) => ({ tenantId: r.tenantId, tenantName: r.tenantName, dueOn: r.nextDueOn!, cents: r.owedCents || 7900 }))
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
    recent: [...payments].sort((a, b) => b.paidOn.localeCompare(a.paidOn)).slice(0, 5),
  };
}

/** Each company's total and last payment, for Cobros. */
export function previewTotals(today: Day, rows: SubscriptionRow[]): Map<string, { total: number; count: number; last: PreviewPayment | null }> {
  const payments = previewPayments(today, rows);
  return new Map(
    rows.map((r) => {
      const mine = payments.filter((p) => p.tenantId === r.tenantId).sort((a, b) => b.paidOn.localeCompare(a.paidOn));
      return [r.tenantId, { total: mine.reduce((s, p) => s + p.receivedCents, 0), count: mine.length, last: mine[0] ?? null }];
    }),
  );
}

/** A company's approved payments. */
export function previewHistory(today: Day, rows: SubscriptionRow[], tenantId: string): PaymentHistory {
  const items = previewPayments(today, rows)
    .filter((p) => p.tenantId === tenantId)
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn))
    .map((p) => ({
      id: p.id,
      paidOn: p.paidOn,
      months: p.months,
      methodName: p.methodName,
      currency: p.currency,
      receivedCents: p.receivedCents,
      receivedAmount: p.receivedAmount,
      coversTo: p.coversTo,
      receiptNumber: p.receiptNumber,
    }));
  return { totalCents: items.reduce((s, p) => s + p.receivedCents, 0), count: items.length, items };
}
