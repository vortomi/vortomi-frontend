import { describe, expect, it } from 'vitest';
import { exemptionLine, sortRows, stateLabel } from '../platform/subscriptions/billing.rules';
import type { SubscriptionRow } from '../../shared/api/subscriptions';
import { previewView } from './subscription.preview';
import { exemptionBadge, exemptionDaysLeft, exemptionNotice } from './subscription.rules';

const TODAY = '2026-11-24';

describe('an exemption from paying, in the company panel (mockup web-49)', () => {
  it('counts its days left, today included; with no end, none', () => {
    expect(exemptionDaysLeft('2026-11-24', TODAY)).toBe(1);
    expect(exemptionDaysLeft('2026-11-30', TODAY)).toBe(7);
    expect(exemptionDaysLeft(null, TODAY)).toBeNull();
  });

  it('shows in the menu and the banner only in its last 7 days', () => {
    expect(exemptionBadge('2027-02-28', TODAY)).toBeNull();
    expect(exemptionBadge('2026-11-28', TODAY)).toBe('5 d');
    expect(exemptionBadge('2026-11-24', TODAY)).toBe('Hoy');
    expect(exemptionBadge(null, TODAY)).toBeNull();
    expect(exemptionNotice('2027-02-28', TODAY, null)).toBeNull();
    expect(exemptionNotice(null, TODAY, null)).toBeNull();
  });

  it('the banner says to choose a plan, or when the chosen one is first paid', () => {
    expect(exemptionNotice('2026-11-28', TODAY, null)).toMatchObject({ tone: 'soon', title: 'Tu exoneración del pago termina el 28 nov.', detail: expect.stringContaining('Elige tu plan') });
    expect(exemptionNotice('2026-11-28', TODAY, { plan: { name: 'Vortomi' } } as never)?.detail).toBe('Tu plan Vortomi se paga desde el 29 nov.');
  });

  it('the preview has an exempt company with no end, until a day, and ending', () => {
    expect(previewView(TODAY, '?estado=exempt').exemption).toEqual({ endsOn: null });
    expect(previewView(TODAY, '?estado=exempt_ending').exemption).toEqual({ endsOn: '2026-11-28' });
    expect(previewView(TODAY, '?estado=active').exemption).toBeNull();
  });
});

describe('an exemption in the console', () => {
  const row = (tenantName: string, state: SubscriptionRow['state']): SubscriptionRow => ({
    tenantId: tenantName,
    tenantName,
    planName: null,
    billingDay: null,
    nextDueOn: null,
    suspendsOn: null,
    owedCents: 0,
    state,
    exemption: null,
    paidTotalCents: 0,
    paymentsCount: 0,
    lastPaidOn: null,
    lastPaidCents: null,
  });

  it('is a teal «Exonerada», with its reason and end', () => {
    expect(stateLabel({ state: 'exempt', nextDueOn: null }, TODAY)).toEqual({ text: 'Exonerada', tone: 'teal' });
    expect(exemptionLine({ reason: 'demo', endsOn: null })).toBe('Cuenta de demostración · sin fecha de fin');
    expect(exemptionLine({ reason: 'founder', endsOn: '2027-02-28' })).toBe('Cliente fundador · hasta el 28 feb 2027');
  });

  it('goes after the companies that owe or pay, before those without a plan', () => {
    expect(sortRows([row('A', 'none'), row('B', 'exempt'), row('C', 'active')]).map((r) => r.tenantName)).toEqual(['C', 'B', 'A']);
  });
});
