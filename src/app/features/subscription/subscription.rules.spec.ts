import { describe, expect, it } from 'vitest';
import { tenantOfUrl } from '../../core/api/company-lock.interceptor';
import type { BillingState } from '../../shared/api/subscriptions';
import { formatUsdCents } from '../../shared/format/money';
import { previewSubscription } from '../../shared/api/subscriptions.preview';
import { PREVIEW_PLANS, previewChoice, previewView } from './subscription.preview';
import {
  amountToPay,
  countdown,
  countdownTarget,
  dueAt,
  inBolivares,
  lastPayDay,
  priceFor,
  subscriptionBadge,
  subscriptionEvents,
  subscriptionNotice,
  suspensionAt,
  trialBadge,
  trialDaysLeft,
  trialNotice,
} from './subscription.rules';

const TODAY = '2026-12-01';
const sub = (state: BillingState) => previewSubscription(TODAY, state);

describe('the moments that matter', () => {
  it('is due at 11:59 p. m. and suspends at 00:00, Caracas time', () => {
    expect(dueAt('2026-12-05').toISOString()).toBe('2026-12-06T03:59:00.000Z');
    expect(suspensionAt('2026-12-08').toISOString()).toBe('2026-12-08T04:00:00.000Z');
  });

  it('counts down in days, hours and minutes, and on after it passed', () => {
    const at = suspensionAt('2026-12-04');
    expect(countdown(new Date('2026-12-01T13:55:00Z'), at)).toEqual({ days: 2, hours: 14, minutes: 5, past: false });
    expect(countdown(new Date('2026-12-04T05:00:00Z'), at)).toMatchObject({ days: 0, hours: 1, past: true });
  });

  it('aims at the suspension while a payment is pending, at the due day otherwise', () => {
    expect(countdownTarget(sub('awaiting_first_payment'))).toEqual({ at: suspensionAt('2026-12-04'), suspension: true });
    expect(countdownTarget(sub('grace')).suspension).toBe(true);
    expect(countdownTarget(sub('active'))).toEqual({ at: dueAt('2026-12-21'), suspension: false });
  });
});

describe('the reminders', () => {
  it('gives the last day to pay before the suspension', () => {
    expect(lastPayDay(sub('awaiting_first_payment'))).toBe('2026-12-03');
  });

  it('counts the menu badge down to the last day to pay or the due day', () => {
    expect(subscriptionBadge(sub('awaiting_first_payment'), TODAY)).toBe('2 d');
    expect(subscriptionBadge(sub('awaiting_first_payment'), '2026-12-03')).toBe('Hoy');
    expect(subscriptionBadge(sub('due_soon'), TODAY)).toBe('5 d');
    expect(subscriptionBadge(sub('grace'), TODAY)).toBe('!');
    expect(subscriptionBadge(sub('active'), TODAY)).toBeNull();
  });

  it('says it plainly in the banner, and a company locked out cannot close it', () => {
    expect(subscriptionNotice(sub('awaiting_first_payment'), formatUsdCents)).toMatchObject({
      tone: 'soon',
      title: 'Haz tu primer pago antes del 3 dic.',
      detail: 'Si no, el 4 dic tu cuenta se suspende.',
      dismissable: true,
    });
    expect(subscriptionNotice(sub('suspended'), formatUsdCents)).toMatchObject({ tone: 'overdue', title: 'Tu cuenta está suspendida por falta de pago.', dismissable: false });
    expect(subscriptionNotice({ ...sub('suspended'), enforced: false }, formatUsdCents)?.title).toBe('Tu pago está vencido desde el 28 nov.');
    expect(subscriptionNotice(sub('active'), formatUsdCents)).toBeNull();
  });
});

describe('the trial, while the company has no plan', () => {
  it('counts the days left, today included', () => {
    expect(trialDaysLeft('2026-12-05', TODAY)).toBe(5);
    expect(trialDaysLeft('2026-12-01', TODAY)).toBe(1);
    expect(trialDaysLeft('2026-11-30', TODAY)).toBe(0);
    expect(trialBadge('2026-12-05', TODAY)).toBe('5 d');
    expect(trialBadge('2026-12-01', TODAY)).toBe('Hoy');
    expect(trialBadge('2026-11-30', TODAY)).toBe('!');
  });

  it('asks to choose a plan, and once it is over a company locked out cannot close it', () => {
    expect(trialNotice('2026-12-05', TODAY, true)).toMatchObject({ tone: 'soon', title: 'Elige tu plan.', detail: 'Te quedan 5 días de prueba (hasta el 5 dic).', dismissable: true });
    expect(trialNotice('2026-11-30', TODAY, true)).toMatchObject({ tone: 'overdue', title: 'Tu prueba terminó.', dismissable: false });
    expect(trialNotice('2026-11-30', TODAY, false)).toMatchObject({ title: 'Tu prueba terminó el 30 nov.', dismissable: true });
  });
});

describe('what to pay', () => {
  it('applies the discount of the months chosen to the charge’s own price', () => {
    expect(priceFor({ priceCents: 7900, discounts: { '1': 0, '3': 5, '6': 10, '12': 20 } }, 12)).toEqual({
      discountPercent: 20,
      monthlyCents: 6320,
      totalCents: 75840,
      savedCents: 18960,
    });
    const s = sub('awaiting_first_payment');
    expect(amountToPay(s, 1).dueCents).toBe(7900);
    expect(amountToPay({ ...s, charge: { ...s.charge!, paidCents: 2500 } }, 1).dueCents).toBe(5400);
    expect(amountToPay({ ...s, charge: { ...s.charge!, basePriceCents: 6900 } }, 3).dueCents).toBe(19665);
  });

  it('turns dollars into bolívares at Vortomi’s rate', () => {
    expect(inBolivares(7900, '410.55000000')).toBe(32433.45);
  });
});

describe('the timeline and the preview', () => {
  it('lists the real dates, newest first', () => {
    expect(subscriptionEvents(sub('awaiting_first_payment'), formatUsdCents).map((e) => [e.on, e.kind])).toEqual([
      ['2026-12-04', 'suspension'],
      ['2026-12-01', 'due'],
      ['2026-12-01', 'assigned'],
    ]);
  });

  it('picks the preview state from the address', () => {
    expect(previewView(TODAY, '?estado=grace').subscription?.state).toBe('grace');
    expect(previewView(TODAY, '?estado=none')).toMatchObject({ subscription: null, trialEndsOn: null });
    expect(previewView(TODAY, '')).toMatchObject({ subscription: null, trialEndsOn: '2026-12-05' });
  });

  it('a plan the company chooses carries the months it chose', () => {
    const view = previewChoice(PREVIEW_PLANS[1]!, 3, TODAY, null);
    expect(view).toMatchObject({ origin: 'company', owedCents: 22515, charge: { months: 3, discountPercent: 5, amountCents: 22515 } });
  });

  it('knows which company a call was about', () => {
    expect(tenantOfUrl('/api/tenants/abc-1/conversations?x=1')).toBe('abc-1');
    expect(tenantOfUrl('/api/platform/plans')).toBeNull();
  });
});
