import type { Subscription } from './subscription.models';
import {
  addDays,
  billingFigures,
  billingStatus,
  daysBetween,
  fitsPlan,
  matchesFilter,
  monthTitle,
  nextMonthDay,
  shiftMonths,
  statusLabel,
} from './subscription.rules';
import { SAMPLE_PLANS, sampleSubscriptions } from './subscription.sample';

const TODAY = '2026-11-19';
const sub = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 'sub_x',
  companyName: 'Óptica Visión',
  companyLine: 'Óptica · Maracay',
  plan: 'basic',
  since: '2026-09-10',
  billingDay: 10,
  nextChargeOn: '2026-12-10',
  trialEndsOn: null,
  graceUntil: null,
  usersUsed: 2,
  numbersUsed: 1,
  payments: [],
  ...overrides,
});

describe('subscription days', () => {
  it('adds and counts calendar days across months', () => {
    expect(addDays('2026-11-28', 5)).toBe('2026-12-03');
    expect(daysBetween('2026-11-10', TODAY)).toBe(9);
    expect(daysBetween(TODAY, '2026-11-10')).toBe(-9);
  });

  it('keeps the billing day inside short months, forward and back', () => {
    expect(nextMonthDay('2026-01-31', 31)).toBe('2026-02-28');
    expect(nextMonthDay('2026-02-28', 31)).toBe('2026-03-31');
    expect(nextMonthDay('2026-12-10', 10)).toBe('2027-01-10');
    expect(shiftMonths('2026-03-31', 31, -1)).toBe('2026-02-28');
    expect(shiftMonths('2026-01-15', 15, -2)).toBe('2025-11-15');
  });
});

describe('billingStatus', () => {
  it('reads each case', () => {
    expect(billingStatus(sub({ plan: 'internal' }), TODAY)).toBe('free');
    expect(billingStatus(sub({ trialEndsOn: '2026-11-25', nextChargeOn: '2026-11-25' }), TODAY)).toBe('trial');
    expect(billingStatus(sub({ nextChargeOn: '2026-11-10' }), TODAY)).toBe('overdue');
    expect(billingStatus(sub({ nextChargeOn: '2026-11-10', graceUntil: '2026-11-26' }), TODAY)).toBe('grace');
    expect(billingStatus(sub({ nextChargeOn: '2026-11-24' }), TODAY)).toBe('due_soon');
    expect(billingStatus(sub({ nextChargeOn: '2026-11-25' }), TODAY)).toBe('paid');
  });

  it('counts as overdue again once the grace or the trial is over', () => {
    expect(billingStatus(sub({ nextChargeOn: '2026-11-10', graceUntil: '2026-11-18' }), TODAY)).toBe('overdue');
    expect(billingStatus(sub({ trialEndsOn: '2026-11-18', nextChargeOn: '2026-11-18' }), TODAY)).toBe('overdue');
  });

  it('says it in words, singular and plural', () => {
    expect(statusLabel(sub({ nextChargeOn: '2026-11-10' }), TODAY)).toEqual({ text: 'Atrasada 9 días', tone: 'red' });
    expect(statusLabel(sub({ nextChargeOn: '2026-11-18' }), TODAY).text).toBe('Atrasada 1 día');
    expect(statusLabel(sub({ nextChargeOn: TODAY }), TODAY).text).toBe('Vence hoy');
    expect(statusLabel(sub({ nextChargeOn: '2026-11-22' }), TODAY).text).toBe('Vence en 3 días');
    expect(statusLabel(sub({ trialEndsOn: '2026-11-25', nextChargeOn: '2026-11-25' }), TODAY).text).toBe('Prueba gratis · 6 días');
    expect(statusLabel(sub({ plan: 'internal' }), TODAY)).toEqual({ text: 'Sin cobro', tone: 'neutral' });
  });

  it('files grace under «Atrasadas» and leaves the internal company out of «Al día»', () => {
    expect(matchesFilter('grace', 'overdue')).toBe(true);
    expect(matchesFilter('free', 'paid')).toBe(false);
    expect(matchesFilter('free', 'all')).toBe(true);
  });
});

describe('billingFigures', () => {
  it('adds the fees of the paying companies, what came in this month and what is owed', () => {
    const subs = [
      sub({ id: 'a', plan: 'team', nextChargeOn: '2026-12-01', payments: [{ id: 'p', month: '2026-11', amountCents: 7900, method: 'zelle', reference: '1', paidOn: '2026-11-02', receiptName: null }] }),
      sub({ id: 'b', plan: 'basic', nextChargeOn: '2026-11-10' }),
      sub({ id: 'c', plan: 'team', nextChargeOn: '2026-11-22' }),
      sub({ id: 'd', plan: 'basic', trialEndsOn: '2026-11-21', nextChargeOn: '2026-11-21' }),
      sub({ id: 'e', plan: 'internal' }),
    ];
    expect(billingFigures(subs, SAMPLE_PLANS, TODAY)).toEqual({
      monthlyCents: 7900 + 3900 + 7900,
      paying: 3,
      collectedCents: 7900,
      collectedFrom: 1,
      owedCents: 3900 + 7900,
      overdue: 1,
      trials: 1,
      firstTrialEndsIn: 2,
    });
  });
});

describe('plans', () => {
  it('blocks a plan the company does not fit in', () => {
    const basic = SAMPLE_PLANS.find((p) => p.plan === 'basic')!;
    expect(fitsPlan({ usersUsed: 2, numbersUsed: 1 }, basic)).toBe(true);
    expect(fitsPlan({ usersUsed: 3, numbersUsed: 1 }, basic)).toBe(false);
    expect(fitsPlan({ usersUsed: 1, numbersUsed: 2 }, basic)).toBe(false);
  });

  it('names the month with a capital letter', () => {
    expect(monthTitle('2026-11')).toBe('Noviembre');
  });
});

describe('sample', () => {
  it('builds every status from today, with payments in the months before the next charge', () => {
    const subs = sampleSubscriptions(TODAY);
    const statuses = new Set(subs.map((s) => billingStatus(s, TODAY)));
    expect([...statuses].sort()).toEqual(['due_soon', 'free', 'overdue', 'paid', 'trial']);
    for (const s of subs) {
      for (const p of s.payments) expect(p.month < s.nextChargeOn.slice(0, 7)).toBe(true);
      expect(s.since <= TODAY).toBe(true);
    }
  });
});
