import { formatAmount, parseAmount } from '../../shared/format/money';
import { lineCents, lineText, normalizeReference, validReference } from './orders.models';

describe('order lines', () => {
  it('reads pieces as "2 ×" and what is weighed in its unit, the Venezuelan way', () => {
    expect(lineText({ name: 'Recarga 19L', quantity: 2, saleUnit: 'unit', unitPriceCents: 90 })).toBe('2 × Recarga 19L');
    expect(lineText({ name: 'Queso blanco', quantity: 0.15, saleUnit: 'kg', unitPriceCents: 999 })).toBe('0,15 kg de Queso blanco');
  });

  it('costs quantity × unit price rounded to the cent, as the server does', () => {
    expect(lineCents({ name: 'Queso blanco', quantity: 0.15, saleUnit: 'kg', unitPriceCents: 999 })).toBe(150);
    expect(lineCents({ name: 'Tela', quantity: 1.25, saleUnit: 'm', unitPriceCents: 340 })).toBe(425);
    expect(lineCents({ name: 'Recarga 19L', quantity: 2, saleUnit: 'unit', unitPriceCents: 90 })).toBe(180);
  });
});

describe('checking a payment', () => {
  it('keeps the reference as the server does, and asks for at least 4 letters or digits', () => {
    expect(normalizeReference(' 000 123 456 ')).toBe('000123456');
    expect(normalizeReference('ab-12')).toBe('AB-12');
    expect(validReference('1234')).toBe(true);
    expect(validReference('123')).toBe(false);
    expect(validReference('12.34')).toBe(false);
  });

  it('reads the amount however it is typed, in any currency, and shows it in its own', () => {
    expect(parseAmount('1.234,50 Bs')).toBe('1234.50');
    expect(parseAmount('20 $')).toBe('20.00');
    expect(parseAmount('15€')).toBe('15.00');
    expect(parseAmount('abc')).toBeNull();
    expect(formatAmount(1234.5, 'VES')).toBe('1.234,50 Bs');
    expect(formatAmount(20, 'USD')).toBe('20,00 $');
    expect(formatAmount(15, 'EUR')).toBe('15,00 €');
  });
});
