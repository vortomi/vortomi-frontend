import { TestBed } from '@angular/core/testing';
import type { Product, ProductVariant } from '../../shared/api/models';
import { InventoryData } from './inventory.data';
import { StockSetForm, plainQuantity, today } from './stock-set-form';

const PRODUCT = { id: 'p1', name: 'Café con leche', saleUnit: 'unit', stockMode: 'units' } as Product;
const VARIANT = { id: 'v1', productId: 'p1', name: 'Única', onHand: 100, reserved: 0 } as ProductVariant;

async function setup() {
  const data = { recordCount: vi.fn(() => Promise.resolve({ changed: 1 })) };
  TestBed.configureTestingModule({ providers: [{ provide: InventoryData, useValue: data }] });
  const fixture = TestBed.createComponent(StockSetForm);
  fixture.componentRef.setInput('product', PRODUCT);
  fixture.componentRef.setInput('variants', [VARIANT]);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const saved = vi.fn();
  fixture.componentInstance.saved.subscribe(saved);
  return { fixture, host, data, saved };
}

describe('StockSetForm (the inventory list box)', () => {
  it('starts at what is on the shelf; writing 50 where there are 100 saves 50, not 100 − 50', async () => {
    const { fixture, host, data, saved } = await setup();
    const input = host.querySelector<HTMLInputElement>('input[inputmode=decimal]')!;
    expect(input.value).toBe('100');
    input.value = '50';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.textContent).toContain('−50');
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Guardar'))!.click();
    await fixture.whenStable();
    // The reason follows the change until the person writes their own.
    expect(data.recordCount).toHaveBeenCalledWith([{ variantId: 'v1', counted: 50 }], 'De 100 a 50 · ' + today());
    expect(saved).toHaveBeenCalled();
  });

  it('nothing to save while the amount does not change', async () => {
    const { host } = await setup();
    expect([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Guardar'))!.disabled).toBe(true);
  });

  it('amounts are typed back without a thousands dot, which would read as decimals', () => {
    expect(plainQuantity(1500)).toBe('1500');
    expect(plainQuantity(12.5)).toBe('12,5');
  });
});
