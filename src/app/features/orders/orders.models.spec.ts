import { lineCents, lineText } from './orders.models';

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
