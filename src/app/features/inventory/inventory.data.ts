import { Injectable, computed, inject } from '@angular/core';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { Id, Product, ProductVariant, StockMovement, StockMovementKind } from '../../shared/api/models';
import { allLoaded, newId } from '../../shared/api/mock-db';
import { editableTable } from '../../shared/api/editable-table';
import { type StockStatus, freeUnits, movementError, priceRange, productStatus } from './inventory.rules';
import type { ProductImportRow } from './product-import';

export interface InventoryItem {
  product: Product;
  variants: ProductVariant[];
  status: StockStatus;
  range: { min: number; max: number } | null;
  freeUnits: number;
}

export type VariantDraft = Pick<ProductVariant, 'name' | 'sku' | 'priceCents' | 'lowStockThreshold'> & {
  id: Id | null;
  /** Only for new variants: becomes an "initial" movement. */
  initialStock: number;
};

/** Products, variants and stock movements of the active company. */
@Injectable({ providedIn: 'root' })
export class InventoryData {
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);

  private readonly productTable = editableTable<Product>('products');
  private readonly variantTable = editableTable<ProductVariant>('product-variants');
  private readonly movementTable = editableTable<StockMovement>('stock-movements');

  readonly ready = computed(() => allLoaded(this.productTable, this.variantTable, this.movementTable));

  private readonly tenantId = computed(() => this.session.tenant()?.id ?? '');
  readonly products = computed(() =>
    this.productTable
      .rows()
      .filter((p) => p.tenantId === this.tenantId())
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  );
  readonly variants = computed(() => this.variantTable.rows().filter((v) => v.tenantId === this.tenantId()));
  readonly variantById = computed(() => new Map(this.variants().map((v) => [v.id, v])));
  readonly productById = computed(() => new Map(this.products().map((p) => [p.id, p])));
  readonly categories = computed(() => [...new Set(this.products().map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'es')));

  readonly items = computed<InventoryItem[]>(() => {
    const byProduct = new Map<Id, ProductVariant[]>();
    for (const v of this.variants()) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v]);
    return this.products().map((product) => {
      const variants = byProduct.get(product.id) ?? [];
      return {
        product,
        variants,
        status: productStatus(product, variants),
        range: priceRange(variants),
        freeUnits: variants.reduce((sum, v) => sum + freeUnits(v), 0),
      };
    });
  });

  movementsOf(productId: Id): StockMovement[] {
    const ids = new Set(this.variants().filter((v) => v.productId === productId).map((v) => v.id));
    return this.movementTable
      .rows()
      .filter((m) => ids.has(m.variantId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Creates or updates a product and its variants. Stock is never edited here, only through movements. */
  saveProduct(product: Omit<Product, 'id' | 'tenantId' | 'createdAt'> & { id: Id | null }, variants: VariantDraft[]): Id {
    const now = this.clock.now().toISOString();
    const productId = product.id ?? newId('prd');
    const existing = this.productById().get(productId);
    this.productTable.upsert({ ...product, id: productId, tenantId: this.tenantId(), createdAt: existing?.createdAt ?? now });

    const keep = new Set(variants.map((v) => v.id).filter(Boolean));
    this.variants()
      .filter((v) => v.productId === productId && !keep.has(v.id))
      .forEach((v) => this.variantTable.remove(v.id));

    for (const draft of variants) {
      if (draft.id) {
        this.variantTable.patch(draft.id, { name: draft.name, sku: draft.sku, priceCents: draft.priceCents, lowStockThreshold: draft.lowStockThreshold });
        continue;
      }
      const id = newId('var');
      this.variantTable.upsert({ ...draft, id, tenantId: this.tenantId(), productId, onHand: 0, reserved: 0, available: true });
      if (draft.initialStock > 0) this.recordMovement(id, 'initial', draft.initialStock, 'Carga inicial');
    }
    return productId;
  }

  recordMovement(variantId: Id, kind: StockMovementKind, quantity: number, reason: string): string | null {
    const variant = this.variantById().get(variantId);
    if (!variant) return 'Esa variante ya no existe.';
    const error = movementError(variant, quantity);
    if (error) return error;
    this.movementTable.upsert({
      id: newId('mov'),
      tenantId: this.tenantId(),
      variantId,
      kind,
      quantity,
      reason: reason.trim() || 'Sin motivo',
      userId: this.session.user()?.id ?? 'system',
      createdAt: this.clock.now().toISOString(),
    });
    this.variantTable.patch(variantId, { onHand: variant.onHand + quantity });
    return null;
  }

  setAvailable(variantId: Id, available: boolean): void {
    this.variantTable.patch(variantId, { available });
  }

  setActive(productId: Id, active: boolean): void {
    this.productTable.patch(productId, { active });
  }

  /** Applies an analysed import: new SKUs create products/variants, known SKUs update price and stock. */
  applyImport(rows: ProductImportRow[]): { created: number; updated: number } {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      if (row.status === 'error' || row.priceCents === null) continue;
      const existing = this.variants().find((v) => v.sku === row.sku);
      if (existing) {
        this.variantTable.patch(existing.id, { priceCents: row.priceCents });
        if (row.stock !== null && row.stock !== existing.onHand) {
          this.recordMovement(existing.id, 'adjustment', row.stock - existing.onHand, 'Importación desde archivo');
        }
        updated++;
        continue;
      }
      const productId =
        this.products().find((p) => p.name.toLowerCase() === row.product.toLowerCase())?.id ??
        this.saveProduct(
          { id: null, name: row.product, category: row.category, description: '', photoDataUrl: null, stockMode: 'units', active: true },
          [],
        );
      const variantId = newId('var');
      this.variantTable.upsert({
        id: variantId,
        tenantId: this.tenantId(),
        productId,
        name: row.variant,
        sku: row.sku,
        priceCents: row.priceCents,
        onHand: 0,
        reserved: 0,
        available: true,
        lowStockThreshold: 0,
      });
      if (row.stock) this.recordMovement(variantId, 'initial', row.stock, 'Importación desde archivo');
      created++;
    }
    return { created, updated };
  }
}
