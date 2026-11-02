import { paymentMessage } from './payment-message';
import { hasValidFormat, joinDocument, joinPhone, splitDocument, splitPhone } from './venezuelan-formats';

describe('Venezuelan payment data', () => {
  it('checks banks, phones and documents the way the server does', () => {
    expect(hasValidFormat('bank', '0134 · Banesco')).toBe(true);
    expect(hasValidFormat('bank', 'Banesco')).toBe(false);
    expect(hasValidFormat('phone', '0414-1234567')).toBe(true);
    expect(hasValidFormat('phone', '0212-1234567')).toBe(false);
    for (const ok of ['J-50472711-3', 'V-12345678', 'E-1234567', 'V-12345678-9', 'G-20000001-4', 'P-AB123456']) expect(hasValidFormat('document', ok)).toBe(true);
    expect(hasValidFormat('document', 'J-1234567')).toBe(false);
  });

  it('keeps the code and the letter while the number is typed', () => {
    expect(joinPhone('0424', '')).toBe('0424-');
    expect(splitPhone('0424-')).toEqual({ prefix: '0424', number: '' });
    expect(joinPhone('0414', '123 45 67 89')).toBe('0414-1234567');
    expect(joinDocument('J', '504727113')).toBe('J-50472711-3');
    expect(joinDocument('V', '12.345.678')).toBe('V-12345678');
    expect(joinDocument('P', 'ab-123456')).toBe('P-AB123456');
    expect(splitDocument('V-')).toEqual({ type: 'V', number: '' });
    expect(splitDocument('')).toEqual({ type: 'J', number: '' });
  });
});

describe('payment message preview', () => {
  const pagoMovil = {
    type: 'pago_movil' as const,
    name: 'Pago móvil',
    currency: 'VES' as const,
    fields: [{ kind: 'phone' as const, label: 'Teléfono', value: '0414-1234567', copyable: true }],
    instructions: '',
    referenceRule: 'required' as const,
    receiptRule: 'required' as const,
  };

  it('asks to pay to register the order: each datum on its line, the amount in the method currency, no code', () => {
    expect(paymentMessage(pagoMovil, { customerName: 'Luis David', totalCents: 280, bsPerUsd: '888.12' })).toBe(
      '¡Perfecto, Luis! Para registrar tu pedido, por favor realiza el pago por Pago móvil:\n\n' +
        'Teléfono: 0414-1234567\nMonto a pagar: Bs 2.486,74\n\n' +
        'Cuando pagues, envíanos por aquí el capture del comprobante, con el número de referencia visible.',
    );
  });

  it('the company instructions replace our closing line; it always speaks as the business', () => {
    const text = paymentMessage({ ...pagoMovil, instructions: 'Envíanos el comprobante.' }, { customerName: 'Ana', totalCents: 280, bsPerUsd: null });
    expect(text).toContain('Monto a pagar: te lo confirmamos en un momento\n\nEnvíanos el comprobante.');
    expect(text).not.toContain('Cuando pagues');
    const cash = { ...pagoMovil, type: 'cash_usd' as const, name: 'Efectivo en dólares', currency: 'USD' as const, fields: [], referenceRule: 'none' as const, receiptRule: 'none' as const };
    expect(paymentMessage(cash, { customerName: 'Ana', totalCents: 180, bsPerUsd: null })).toBe(
      '¡Perfecto, Ana! Tu pedido se paga con Efectivo en dólares:\n\nMonto a pagar: USD 1,80\n\nLo revisamos y te confirmamos en breve.',
    );
  });
});
