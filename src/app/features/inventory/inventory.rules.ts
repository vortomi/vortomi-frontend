// Pure inventory rules (documentations/05-inventario.md).
import type { Product, ProductVariant, StockMovementKind } from '../../shared/api/models';
export { parsePriceCents } from '../../shared/format/money';

export type StockStatus = 'available' | 'low' | 'out' | 'unavailable' | 'inactive';

export const MOVEMENT_LABEL: Record<StockMovementKind, string> = {
  initial: 'Carga inicial',
  purchase: 'Entrada',
  sale: 'Venta',
  adjustment: 'Ajuste',
  loss: 'Merma',
  return: 'Devolución',
};

/** Units that can still be sold: what is on the shelf minus what is set aside for quotes. */
export function freeUnits(variant: ProductVariant): number {
  return Math.max(0, variant.onHand - variant.reserved);
}

export function variantStatus(product: Product, variant: ProductVariant): StockStatus {
  if (!product.active) return 'inactive';
  if (product.stockMode === 'availability') return variant.available ? 'available' : 'unavailable';
  const free = freeUnits(variant);
  if (free === 0) return 'out';
  return free <= variant.lowStockThreshold ? 'low' : 'available';
}

/** Summary for the product row: out only when every variant is out. */
export function productStatus(product: Product, variants: ProductVariant[]): StockStatus {
  if (!product.active) return 'inactive';
  const statuses = variants.map((v) => variantStatus(product, v));
  if (!statuses.length) return 'out';
  if (statuses.every((s) => s === 'out' || s === 'unavailable')) return product.stockMode === 'availability' ? 'unavailable' : 'out';
  return statuses.some((s) => s === 'low' || s === 'out') ? 'low' : 'available';
}

/**
 * A movement never leaves fewer units than those already set aside: that would sell what was
 * promised to someone else. The backend repeats it with a CHECK (on_hand >= reserved).
 */
export function movementError(variant: ProductVariant, quantity: number): string | null {
  if (!Number.isInteger(quantity) || quantity === 0) return 'Escribe una cantidad entera distinta de cero.';
  const next = variant.onHand + quantity;
  if (next < 0) return `No hay tantas unidades: quedan ${variant.onHand}.`;
  if (next < variant.reserved) return `Quedarían menos unidades que las apartadas (${variant.reserved}).`;
  return null;
}

/** SKUs are upper case, digits and dashes, unique inside the company. */
export function skuError(sku: string, taken: string[]): string | null {
  if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(sku)) return 'SKU: mayúsculas, números y guiones (ej.: FRN-BOS-COR15).';
  if (taken.includes(sku)) return `El SKU ${sku} ya existe.`;
  return null;
}

export function priceRange(variants: ProductVariant[]): { min: number; max: number } | null {
  if (!variants.length) return null;
  const prices = variants.map((v) => v.priceCents);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function toBolivares(cents: number, rate: number): number {
  return Math.round((cents / 100) * rate * 100) / 100;
}
