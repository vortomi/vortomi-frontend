import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Product, ProductVariant } from '../../shared/api/models';
import { Confirm } from '../../shared/ui/confirm';
import { InventoryData, type InventoryItem } from './inventory.data';
import { StockCountPage } from './stock-count.page';

const product = (id: string, name: string, saleUnit: Product['saleUnit'] = 'unit', stockMode: Product['stockMode'] = 'units') =>
  ({ id, name, saleUnit, stockMode }) as Product;
const variant = (id: string, productId: string, onHand: number) => ({ id, productId, name: 'Única', onHand }) as ProductVariant;

const ITEMS: InventoryItem[] = [
  { product: product('p1', 'Golfeado'), variants: [variant('v1', 'p1', 30)], status: 'available', range: null, freeUnits: 30 },
  { product: product('p2', 'Pan de jamón'), variants: [variant('v2', 'p2', 100)], status: 'available', range: null, freeUnits: 100 },
  { product: product('p3', 'Torta por encargo', 'unit', 'availability'), variants: [variant('v3', 'p3', 0)], status: 'available', range: null, freeUnits: 0 },
];

async function setup() {
  const data = { ready: signal(true), items: signal(ITEMS), recordCount: vi.fn(() => Promise.resolve({ changed: 1 })) };
  // Says yes and runs the action, as the dialog does when the person confirms.
  const confirm = { ask: vi.fn(async (request: { action?: () => Promise<unknown> }) => (await request.action?.(), true)) };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: InventoryData, useValue: data }, { provide: Confirm, useValue: confirm }],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(StockCountPage);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const count = async (name: string, text: string) => {
    const input = host.querySelector<HTMLInputElement>(`input[aria-label="Hay ahora de ${name}"]`)!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const saveButton = () => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Guardar'))!;
  return { fixture, host, data, count, saveButton, navigate };
}

describe('StockCountPage', () => {
  it('lists only counted products, each starting at what Vortomi has', async () => {
    const { host } = await setup();
    expect(host.querySelector('input[aria-label="Hay ahora de Golfeado"]')).not.toBeNull();
    expect(host.querySelector('input[aria-label="Hay ahora de Torta por encargo"]')).toBeNull();
  });

  it('saves only what differs, with its difference shown', async () => {
    const { fixture, host, data, count, saveButton, navigate } = await setup();
    expect(saveButton().disabled).toBe(true);
    await count('Golfeado', '26');
    expect(host.textContent).toContain('−4');
    expect(saveButton().disabled).toBe(false);
    saveButton().click();
    await fixture.whenStable();
    expect(data.recordCount).toHaveBeenCalledWith([{ variantId: 'v1', counted: 26 }], expect.stringContaining('Actualización del'));
    expect(navigate).toHaveBeenCalledWith('/inventory');
  });
});
