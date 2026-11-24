import { describe, expect, it } from 'vitest';
import type { ReviewDetail } from '../../../shared/api/subscriptions';
import { addMonthsOn, approvalSteps } from './review.rules';

const detail = (overrides: Partial<ReviewDetail> = {}): ReviewDetail =>
  ({
    id: 'p1',
    tenantId: 't1',
    tenantName: 'La Campiña',
    status: 'in_review',
    planName: 'Vortomi',
    months: 3,
    methodName: 'Pago móvil',
    reference: '000451287',
    paidOn: '2026-12-01',
    submittedAt: '2026-12-01T15:00:00Z',
    currency: 'VES',
    amount: '92435.33',
    amountUsdCents: 22515,
    owedCents: 22515,
    coverage: 'full',
    receiptNumber: null,
    payment: { paidOn: '2026-12-01', bsPerUsd: '410.55' },
    charge: { months: 3, amountCents: 22515, paidCents: 0, dueOn: '2026-12-01', discountPercent: 5 },
    billingDay: null,
    nextDueOn: '2026-12-01',
    ...overrides,
  }) as ReviewDetail;

describe('what approving does', () => {
  it('a first payment in full: the charge paid, the billing day set, the next date, the receipt', () => {
    expect(approvalSteps(detail(), 22515)).toEqual([
      'Abona 225,15 $ a su cobro de 3 meses: queda pagado.',
      'Su día de cobro queda fijo: los 1 de cada mes.',
      'Su próximo pago vence el 1 mar 2027.',
      'Se genera su recibo en PDF.',
    ]);
  });

  it('with something extra, the extra goes to the balance', () => {
    expect(approvalSteps(detail(), 23015)).toContain('Los 5,00 $ de más van a su saldo a favor.');
  });

  it('partial: what is still owed, and no date moves', () => {
    const steps = approvalSteps(detail(), 5000);
    expect(steps[0]).toBe('Abona 50,00 $ a su cobro de 3 meses: sigue debiendo 175,15 $.');
    expect(steps.join(' ')).not.toContain('próximo pago');
  });

  it('a later period runs from the due day it pays, on the billing day', () => {
    const later = detail({ billingDay: 31, charge: { months: 1, amountCents: 7900, paidCents: 0, dueOn: '2027-01-31', discountPercent: 0 } });
    expect(approvalSteps(later, 7900)).toContain('Su próximo pago vence el 28 feb 2027.');
  });

  it('moves a due day by months, short months included', () => {
    expect(addMonthsOn('2027-01-31', 1, 31)).toBe('2027-02-28');
    expect(addMonthsOn('2027-02-28', 1, 31)).toBe('2027-03-31');
  });
});
