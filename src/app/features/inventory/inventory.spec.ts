import type { Product, ProductVariant } from '../../shared/api/models';
import { movementError, parsePriceCents, productStatus, skuError, toBolivares, variantStatus } from './inventory.rules';
import { analyzeProductImport, guessProductMapping } from './product-import';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'prd', tenantId: 't', name: 'Filtro', categoryId: 'cat', variantTypeIds: [], category: 'Filtros', description: '', photoDataUrl: null,
  stockMode: 'units', saleUnit: 'unit', minQuantity: 1, quantityStep: 1, active: true, createdAt: '2026-10-01T00:00:00Z', ...overrides,
});
const variant = (overrides: Partial<ProductVariant> = {}): ProductVariant => ({
  id: 'var', tenantId: 't', productId: 'prd', optionIds: [], name: 'Única', sku: 'FLT-1', priceCents: 800,
  onHand: 10, reserved: 0, available: true, lowStockThreshold: 3, ...overrides,
});

describe('stock status', () => {
  it('discounts reserved units', () => {
    expect(variantStatus(product(), variant({ onHand: 4, reserved: 2 }))).toBe('low');
    expect(variantStatus(product(), variant({ onHand: 2, reserved: 2 }))).toBe('out');
    expect(variantStatus(product(), variant())).toBe('available');
  });

  it('uses the switch for made-to-order products and respects inactive ones', () => {
    expect(variantStatus(product({ stockMode: 'availability' }), variant({ onHand: 0, available: true }))).toBe('available');
    expect(variantStatus(product({ active: false }), variant())).toBe('inactive');
  });

  it('summarises a product: out only when every variant is out', () => {
    expect(productStatus(product(), [variant({ onHand: 0 }), variant({ onHand: 10 })])).toBe('low');
    expect(productStatus(product(), [variant({ onHand: 0 })])).toBe('out');
  });
});

describe('movements and SKUs', () => {
  it('never leaves fewer units than those set aside', () => {
    expect(movementError(variant({ onHand: 3, reserved: 2 }), -2, 'unit')).toContain('apartado');
    expect(movementError(variant({ onHand: 3 }), -5, 'unit')).toContain('quedan 3 unidades');
    expect(movementError(variant(), 0, 'unit')).toContain('cantidad');
    expect(movementError(variant(), 5, 'unit')).toBeNull();
  });

  it('counts fractions only where the unit takes them', () => {
    expect(movementError(variant({ onHand: 12.5 }), -0.75, 'kg')).toBeNull();
    expect(movementError(variant({ onHand: 12.5 }), -13, 'kg')).toContain('quedan 12,5 kg');
    expect(movementError(variant(), 1.5, 'box')).toContain('entero');
  });

  it('validates SKUs', () => {
    expect(skuError('FRN-BOS-1', [])).toBeNull();
    expect(skuError('frn bos', [])).toContain('mayúsculas');
    expect(skuError('FRN-1', ['FRN-1'])).toContain('ya existe');
  });
});

describe('prices', () => {
  it.each([
    ['38', 3800],
    ['38,50', 3850],
    ['$ 38.5', 3850],
    ['1.234,50', 123450],
    ['1,234.50', 123450],
    ['1.234', 123400],
  ])('parses %s', (text, cents) => {
    expect(parsePriceCents(text)).toBe(cents);
  });

  it.each(['', 'gratis', '0', '-5'])('rejects %s', (text) => {
    expect(parsePriceCents(text)).toBeNull();
  });

  it('converts to bolívares with the company rate', () => {
    expect(toBolivares(3800, 185.5)).toBe(7049);
  });
});

describe('product import', () => {
  it('guesses columns', () => {
    expect(guessProductMapping(['SKU', 'Producto', 'Categoría', 'Marca', 'Precio USD', 'Existencia', 'Se vende por'])).toEqual([
      'sku', 'product', 'category', 'variant', 'price', 'stock', 'unit',
    ]);
  });

  it('classifies rows', () => {
    const rows = [
      ['NEW-1', 'Correa', '12,50', '5'],
      ['FLT-1', '', '9', '2'],
      ['NEW-1', 'Correa', '12', '1'],
      ['BAD SKU', 'X', '1', '1'],
      ['NEW-2', 'Liga', 'gratis', '1'],
      ['NEW-3', '', '3', ''],
    ];
    const result = analyzeProductImport(rows, ['sku', 'product', 'price', 'stock'], [variant()]);
    expect(result.map((r) => r.status)).toEqual(['new', 'update', 'error', 'error', 'error', 'error']);
    expect(result[0]?.priceCents).toBe(1250);
  });

  it('reads the sale unit; fractions only for units that take them', () => {
    const rows = [
      ['TEL-1', 'Tela', '7,50', '42,5', 'Metro'],
      ['TEL-2', 'Tela', '7,50', '42,5', ''],
      ['TEL-3', 'Tela', '7,50', '3', 'Bultos'],
      ['TEL-4', 'Tela', '7,50', '3', 'kg'],
    ];
    const result = analyzeProductImport(rows, ['sku', 'product', 'price', 'stock', 'unit'], []);
    expect(result.map((r) => r.status)).toEqual(['new', 'error', 'error', 'new']);
    expect(result[0]).toMatchObject({ saleUnit: 'm', stock: 42.5 });
    expect(result[3]?.saleUnit).toBe('kg');
  });
});
