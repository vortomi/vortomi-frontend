import { describe, expect, it } from 'vitest';
import type { SubscriptionRow } from '../../../shared/api/subscriptions';
import { previewHistory, previewSummary } from './platform-subscriptions.preview';

const TODAY = '2026-11-24';
const row = (tenantId: string, state: SubscriptionRow['state'], owedCents = 0): SubscriptionRow => ({
  tenantId,
  tenantName: tenantId,
  planName: 'Equipo',
  billingDay: 24,
  nextDueOn: '2026-12-10',
  suspendsOn: '2026-12-13',
  owedCents,
  state,
  exemption: null,
  paidTotalCents: 0,
  paymentsCount: 0,
  lastPaidOn: null,
  lastPaidCents: null,
});
const rows = [row('a', 'active'), row('b', 'grace', 7900), row('c', 'awaiting_first_payment', 7900)];

describe('Suscripciones → Resumen adds up (mockup web-51)', () => {
  it('the chart and the methods add up to the period, for every period', () => {
    for (const period of ['month', 'year', '12m', 'all'] as const) {
      const s = previewSummary(TODAY, period, rows);
      expect(s.buckets.reduce((sum, b) => sum + b.cents, 0)).toBe(s.income.periodCents);
      expect(s.byMethod.reduce((sum, m) => sum + m.cents, 0)).toBe(s.income.periodCents);
    }
  });

  it('a year has its 12 months; «Este mes» one bar per day', () => {
    expect(previewSummary(TODAY, 'year', rows).buckets.map((b) => b.key)).toEqual(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`));
    expect(previewSummary(TODAY, 'month', rows).buckets).toHaveLength(30);
  });

  it('what is owed, and what of it is overdue', () => {
    const s = previewSummary(TODAY, 'year', rows);
    expect(s.owedCents).toBe(15800);
    expect(s.overdueCents).toBe(7900);
    expect(s.overdueCompanies).toBe(1);
  });

  it('a company’s history adds up to its total', () => {
    const h = previewHistory(TODAY, rows, 'a');
    expect(h.totalCents).toBe(h.items.reduce((sum, p) => sum + p.receivedCents, 0));
    expect(h.count).toBe(h.items.length);
  });
});
