import type { SubscriptionPayment } from './subscription.models';
import {
  caracasDay,
  countdown,
  dueAt,
  periodProgress,
  priceFor,
  reminderBadge,
  reminderOf,
  reminderText,
  savedBy,
  timeline,
  yearTotals,
} from './subscription.rules';
import { sampleSubscription } from './subscription.sample';

const payment = (over: Partial<SubscriptionPayment>): SubscriptionPayment => ({
  id: 'p',
  paidOn: '2026-09-21',
  planName: 'Equipo',
  months: 3,
  from: '2026-09-21',
  to: '2026-12-21',
  discountPercent: 5,
  amountCents: 22515,
  method: 'Pago móvil',
  reference: '004512',
  status: 'approved',
  ...over,
});

describe('when the plan is due', () => {
  it('is 11:59 p. m. of its last day, Caracas time', () => {
    expect(dueAt('2026-12-21').toISOString()).toBe('2026-12-22T03:59:00.000Z');
    expect(caracasDay(new Date('2026-12-22T03:30:00Z'))).toBe('2026-12-21');
  });

  it('counts down in days, hours and minutes, and on after it passed', () => {
    const due = dueAt('2026-12-21');
    expect(countdown(new Date('2026-11-23T13:27:00-04:00'), due)).toEqual({ days: 28, hours: 10, minutes: 32, past: false });
    expect(countdown(new Date('2026-12-23T23:59:00-04:00'), due)).toEqual({ days: 2, hours: 0, minutes: 0, past: true });
  });

  it('reminds from 7 days before, and says it plainly', () => {
    const due = dueAt('2026-12-21');
    expect(reminderOf(new Date('2026-12-14T08:00:00-04:00'), due)).toEqual({ level: 'ok', days: 7 });
    expect(reminderOf(new Date('2026-12-15T08:00:00-04:00'), due)).toEqual({ level: 'soon', days: 6 });
    expect(reminderOf(new Date('2026-12-21T20:00:00-04:00'), due)).toEqual({ level: 'soon', days: 0 });
    expect(reminderOf(new Date('2026-12-24T09:00:00-04:00'), due)).toEqual({ level: 'overdue', days: 2 });
    expect(reminderText({ level: 'soon', days: 6 })).toBe('Vence en 6 días');
    expect(reminderText({ level: 'soon', days: 0 })).toBe('Vence hoy');
    expect(reminderText({ level: 'overdue', days: 1 })).toBe('Venció hace 1 día');
    expect(reminderBadge({ level: 'ok', days: 20 })).toBeNull();
    expect(reminderBadge({ level: 'soon', days: 6 })).toBe('6 d');
    expect(reminderBadge({ level: 'overdue', days: 2 })).toBe('!');
  });
});

describe('the period and the prices', () => {
  it('says how much of the period went by', () => {
    expect(periodProgress('2026-09-21', '2026-12-21', '2026-11-23')).toEqual({ elapsed: 63, total: 91, percent: 69 });
    expect(periodProgress('2026-09-21', '2026-12-21', '2027-01-05').percent).toBe(100);
  });

  it('applies the plan’s discount for the months paid', () => {
    const team = { priceCents: 7900, discounts: { '1': 0, '3': 5, '6': 10, '12': 20 } };
    expect(priceFor(team, 1)).toEqual({ discountPercent: 0, monthlyCents: 7900, totalCents: 7900, savedCents: 0 });
    expect(priceFor(team, 3)).toEqual({ discountPercent: 5, monthlyCents: 7505, totalCents: 22515, savedCents: 1185 });
    expect(priceFor(team, 12)).toEqual({ discountPercent: 20, monthlyCents: 6320, totalCents: 75840, savedCents: 18960 });
  });

  it('adds up the year’s approved payments and what their discounts saved', () => {
    const payments = [payment({}), payment({ id: 'q', paidOn: '2026-06-21' }), payment({ id: 'r', paidOn: '2026-05-21', months: 1, discountPercent: 0, amountCents: 3900 }),
      payment({ id: 's', paidOn: '2026-10-01', status: 'rejected' }), payment({ id: 't', paidOn: '2025-12-01' })];
    expect(savedBy(payment({}))).toBe(1185);
    expect(yearTotals(payments, '2026')).toEqual({ paidCents: 48930, payments: 3, savedCents: 2370 });
  });
});

describe('the timeline', () => {
  it('lays each period paid along the months, with today', () => {
    const line = timeline(
      [payment({}), payment({ id: 'q', from: '2026-06-21', to: '2026-09-21' }), payment({ id: 'r', planName: 'Básico', months: 1, from: '2026-05-21', to: '2026-06-21' })],
      '2026-12-21',
      '2026-11-23',
    );
    expect(line.months).toEqual(['may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']);
    expect(line.bars.map((b) => [b.label, b.current])).toEqual([['Básico', false], ['Equipo · 3 meses', false], ['Equipo · 3 meses', true]]);
    expect(line.todayAt).toBeGreaterThan(80);
    expect(line.todayAt).toBeLessThan(95);
  });
});

describe('the sample', () => {
  it('is always 27 days from being due, with three payments in order', () => {
    const s = sampleSubscription('2026-11-23');
    expect(s.endsOn).toBe('2026-12-20');
    expect(s.startsOn).toBe('2026-09-20');
    expect(s.payments.map((p) => p.from)).toEqual(['2026-09-20', '2026-06-20', '2026-05-20']);
    expect(s.payments[0]!.to).toBe(s.endsOn);
  });
});
