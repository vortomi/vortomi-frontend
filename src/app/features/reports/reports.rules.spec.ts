import type { ReportDay } from '../../shared/api/models';
import { byDay, byPerson, comparisonRange, daysOf, percentChange, periodRange, summarize, weightedMedian } from './reports.rules';

const day = (date: string, userId: string | null, counts: Partial<ReportDay> = {}): ReportDay => ({
  tenantId: 'ten_a',
  date,
  userId,
  conversations: 10,
  onTime: 8,
  firstResponseMedianSec: 300,
  wonCount: 0,
  wonCents: 0,
  ...counts,
});

describe('report periods', () => {
  const today = '2026-10-09';

  it('builds the three periods', () => {
    expect(periodRange('last7', today)).toEqual({ from: '2026-10-03', to: '2026-10-09' });
    expect(periodRange('month', today)).toEqual({ from: '2026-10-01', to: '2026-10-09' });
    expect(periodRange('previousMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('compares with a fair stretch before', () => {
    expect(comparisonRange('last7', today)).toEqual({ from: '2026-09-26', to: '2026-10-02' });
    expect(comparisonRange('month', today)).toEqual({ from: '2026-09-01', to: '2026-09-09' });
    expect(comparisonRange('previousMonth', today)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('clamps the same stretch to a shorter previous month', () => {
    expect(comparisonRange('month', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('crosses year boundaries', () => {
    expect(periodRange('previousMonth', '2027-01-05')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(daysOf({ from: '2026-12-30', to: '2027-01-02' })).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });
});

describe('report totals', () => {
  it('weights the median by conversations', () => {
    expect(weightedMedian([{ value: 60, weight: 1 }, { value: 600, weight: 9 }])).toBe(600);
    expect(weightedMedian([])).toBeNull();
  });

  it('sums a period and keeps the unanswered out of the median', () => {
    const totals = summarize([
      day('2026-10-01', 'usr_a', { wonCount: 2, wonCents: 4500 }),
      day('2026-10-01', null, { conversations: 3, onTime: 0, firstResponseMedianSec: null }),
    ]);
    expect(totals).toEqual({ conversations: 13, onTime: 8, medianSec: 300, wonCount: 2, wonCents: 4500 });
  });

  it('fills days without activity with zero', () => {
    const bars = byDay([day('2026-10-02', 'usr_a')], { from: '2026-10-01', to: '2026-10-03' });
    expect(bars.map((b) => b.conversations)).toEqual([0, 10, 0]);
  });

  it('groups per person, with nobody as its own group', () => {
    const groups = byPerson([day('2026-10-01', 'usr_a'), day('2026-10-02', 'usr_a'), day('2026-10-01', null, { firstResponseMedianSec: null })]);
    expect(groups.get('usr_a')?.conversations).toBe(20);
    expect(groups.get(null)?.medianSec).toBeNull();
  });

  it('has no percent change without a previous figure', () => {
    expect(percentChange(118, 100)).toBe(18);
    expect(percentChange(5, 0)).toBeNull();
  });
});
