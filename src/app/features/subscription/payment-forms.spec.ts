import { describe, expect, it } from 'vitest';
import type { PayableMethod } from '../../shared/api/subscriptions';
import { parseTypedDate, typedDate } from '../../shared/ui/date-picker';
import { formOf, parseTypedAmount, type ReportDraft, reportErrors, typedUsdCents } from './payment-forms';

const TODAY = '2026-12-01';
const method = (type: string, overrides: Partial<PayableMethod> = {}): PayableMethod => ({
  id: 'm1',
  type,
  name: type,
  currency: type === 'pago_movil' ? 'VES' : 'USD',
  fields: [],
  instructions: '',
  referenceRule: 'required',
  receiptRule: 'required',
  ...overrides,
});
const proof = { name: 'pago.jpg', size: 200_000, mimeType: 'image/jpeg' };
const draft = (overrides: Partial<ReportDraft> = {}): ReportDraft => ({
  payer: { bank: '0102 · Banco de Venezuela', phone: '0414-1234567', document: 'V-18456789' },
  reference: '000 451 287',
  paidOn: TODAY,
  amount: '92.435,33',
  proof,
  keepsProof: false,
  ...overrides,
});

describe('each method’s form', () => {
  it('pago móvil asks for the bank, phone and ID, and a reference of digits', () => {
    expect(reportErrors(method('pago_movil'), draft(), TODAY)).toEqual({});
    const wrong = reportErrors(method('pago_movil'), draft({ payer: { bank: '', phone: '0414-12345', document: '18456789' }, reference: 'REF-1' }), TODAY);
    expect(Object.keys(wrong).sort()).toEqual(['payer.bank', 'payer.document', 'payer.phone', 'reference']);
  });

  it('zelle asks who sent it: a name, and an e-mail or a US phone', () => {
    const zelle = method('zelle');
    const ok = draft({ payer: { senderName: 'Leopoldo Pérez', senderContact: '+1 (305) 555-1234' }, reference: 'q7k2x9m4p', amount: '225,15' });
    expect(reportErrors(zelle, ok, TODAY)).toEqual({});
    expect(reportErrors(zelle, { ...ok, payer: { senderName: 'Leopoldo Pérez', senderContact: '305-555' } }, TODAY)).toHaveProperty('payer.senderContact');
  });

  it('paypal takes a 17 or 19 character ID; binance an order ID of up to 32', () => {
    const paypal = draft({ payer: { senderEmail: 'leo@gmail.com' }, reference: '8MC585209K746392H', amount: '225.15' });
    expect(reportErrors(method('paypal'), paypal, TODAY)).toEqual({});
    expect(reportErrors(method('paypal'), { ...paypal, reference: '8MC585209K746392' }, TODAY)).toHaveProperty('reference');
    expect(formOf('binance')?.reference?.pattern.test('351276008817264128')).toBe(true);
    expect(formOf('cash_eur')).toBeNull();
  });

  it('within the last 7 days, never in the future, and says what to do past them', () => {
    expect(reportErrors(method('pago_movil'), draft({ paidOn: '2026-12-02' }), TODAY)['paidOn']).toBe('La fecha no puede ser futura.');
    expect(reportErrors(method('pago_movil'), draft({ paidOn: '2026-11-24' }), TODAY)).toEqual({});
    expect(reportErrors(method('pago_movil'), draft({ paidOn: '2026-11-23' }), TODAY)['paidOn']).toContain('agente autorizado de Vortomi');
  });

  it('the receipt: required or optional as the method says, an image or PDF of up to 5 MB', () => {
    expect(reportErrors(method('pago_movil'), draft({ proof: null }), TODAY)['proof']).toBe('Adjunta el comprobante de tu pago.');
    expect(reportErrors(method('pago_movil', { receiptRule: 'optional' }), draft({ proof: null }), TODAY)).toEqual({});
    expect(reportErrors(method('pago_movil'), draft({ proof: null, keepsProof: true }), TODAY)).toEqual({});
    expect(reportErrors(method('pago_movil'), draft({ proof: { ...proof, size: 6 * 1024 * 1024 } }), TODAY)['proof']).toBe('El archivo pesa más de 5 MB.');
    expect(reportErrors(method('pago_movil'), draft({ proof: { ...proof, mimeType: 'text/plain' } }), TODAY)).toHaveProperty('proof');
  });
});

describe('amounts and dates as people type them', () => {
  it('reads Venezuelan amounts, with at most 2 decimals', () => {
    expect(parseTypedAmount('92.435,33')).toBe('92435.33');
    expect(parseTypedAmount('225,15 $')).toBe('225.15');
    expect(parseTypedAmount('225.15')).toBe('225.15');
    expect(parseTypedAmount('1.000')).toBe('1000');
    expect(parseTypedAmount('92.435,333')).toBeNull();
    expect(parseTypedAmount('0')).toBeNull();
  });

  it('turns them into dollar cents at Vortomi’s rate', () => {
    expect(typedUsdCents('92.435,33', 'VES', '410.55')).toBe(22515);
    expect(typedUsdCents('225,15', 'USD', null)).toBe(22515);
  });

  it('reads a date written dd/mm/aaaa, only a real day', () => {
    expect(parseTypedDate('01/12/2026')).toBe('2026-12-01');
    expect(parseTypedDate('31/11/2026')).toBeNull();
    expect(parseTypedDate('1/12/2026')).toBeNull();
    expect(typedDate('2026-12-01')).toBe('01/12/2026');
  });
});
