import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { Id, Product, ProductVariant, StockMovement, StockMovementKind } from '../../shared/api/models';
import { allLoaded, newId } from '../../shared/api/mock-db';
import { editableTable } from '../../shared/api/editable-table';
import { Toaster } from '../../shared/ui/toaster';
import { CategoriesData } from './categories.data';
import { InventoryRemote, type NewVariant } from './inventory-remote';
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

type ProductDraft = Omit<Product, 'id' | 'tenantId' | 'createdAt'> & { id: Id | null };

/**
 * Products, variants and stock movements of the active company.
 * - 'mock': the JSON tables, with in-memory edits until the page reloads.
 * - 'api':  loaded from vortomi-backend; every change goes to the server first and the
 *           screen then shows what the server stored.
 */
@Injectable({ providedIn: 'root' })
export class InventoryData {
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly toaster = inject(Toaster);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(InventoryRemote) : null;
  private readonly categoryList = inject(CategoriesData);

  /**
   * The server does not store photos yet, does not import files, never changes a product's
   * stock mode and never deletes a saved variant (its movements are history).
   */
  readonly onServer = this.remote !== null;

  private readonly productTable = editableTable<Product>('products');
  private readonly variantTable = editableTable<ProductVariant>('product-variants');
  private readonly movementTable = editableTable<StockMovement>('stock-movements');

  readonly ready = computed(() => allLoaded(this.productTable, this.variantTable, this.movementTable) && this.categoryList.ready());

  constructor() {
    if (!this.remote) return;
    effect(() => {
      const tenantId = this.session.tenant()?.id;
      if (tenantId) untracked(() => void this.load(tenantId));
    });
  }

  private readonly tenantId = computed(() => this.session.tenant()?.id ?? '');
  /** The category name always comes from the list, so renaming a category shows everywhere at once. */
  readonly products = computed(() => {
    const categories = this.categoryList.byId();
    return this.productTable
      .rows()
      .filter((p) => p.tenantId === this.tenantId())
      .map((p) => ({ ...p, category: (p.categoryId && categories.get(p.categoryId)?.name) || '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });
  readonly variants = computed(() => this.variantTable.rows().filter((v) => v.tenantId === this.tenantId()));
  readonly variantById = computed(() => new Map(this.variants().map((v) => [v.id, v])));
  readonly productById = computed(() => new Map(this.products().map((p) => [p.id, p])));
  /** Names of the categories that have products, for the list filter. */
  readonly categories = computed(() => [...new Set(this.products().map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));

  /** How many products use each category: one that has any cannot be deleted. */
  readonly productCountByCategory = computed(() => {
    const counts = new Map<Id, number>();
    for (const p of this.products()) if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    return counts;
  });

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

  /**
   * Creates or updates a product and its variants. Stock is never edited here, only through
   * movements. Resolves to the product id, or null when the server refused (its error is shown).
   */
  saveProduct(product: ProductDraft, variants: VariantDraft[]): Promise<Id | null> {
    if (this.remote) return this.saveRemote(this.remote, product, variants);
    return Promise.resolve(this.saveLocal(product, variants));
  }

  private saveLocal(product: ProductDraft, variants: VariantDraft[]): Id {
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
      if (draft.initialStock > 0) this.recordLocal(this.variantById().get(id)!, 'initial', draft.initialStock, 'Carga inicial');
    }
    return productId;
  }

  /** Resolves to the reason it was refused, or null once it is recorded. */
  async recordMovement(variantId: Id, kind: StockMovementKind, quantity: number, reason: string): Promise<string | null> {
    const variant = this.variantById().get(variantId);
    if (!variant) return 'Esa variante ya no existe.';
    const error = movementError(variant, quantity);
    if (error) return error;
    if (this.remote) {
      try {
        this.variantTable.upsert(await this.remote.move(this.tenantId(), variantId, kind, quantity, reason.trim() || 'Sin motivo'));
      } catch (failure) {
        return toApiFailure(failure).message;
      }
      await this.loadMovements(variant.productId);
      return null;
    }
    this.recordLocal(variant, kind, quantity, reason);
    return null;
  }

  private recordLocal(variant: ProductVariant, kind: StockMovementKind, quantity: number, reason: string): void {
    const variantId = variant.id;
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
  }

  setAvailable(variantId: Id, available: boolean): void {
    const variant = this.variantById().get(variantId);
    const remote = this.remote;
    if (remote && variant) {
      void this.attempt(async () => this.variantTable.upsert(await remote.updateVariant(this.tenantId(), { ...variant, available })));
      return;
    }
    this.variantTable.patch(variantId, { available });
  }

  /** 'api' mode: the movement history of one product, read when its page opens. */
  async loadMovements(productId: Id): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    const tenantId = this.tenantId();
    const ids = this.variants().filter((v) => v.productId === productId).map((v) => v.id);
    await this.attempt(async () => {
      const lists = await Promise.all(ids.map((id) => remote.history(tenantId, id)));
      const others = this.movementTable.rows().filter((m) => !ids.includes(m.variantId));
      this.movementTable.replaceAll([...others, ...lists.flat()]);
    });
  }

  private async load(tenantId: Id): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    await this.attempt(async () => {
      const { products, variants } = await remote.list(tenantId);
      this.productTable.replaceAll(products);
      this.variantTable.replaceAll(variants);
      if (this.movementTable.status() !== 'local') this.movementTable.replaceAll([]);
    });
  }

  /**
   * 'api' mode. The server has no single "save product" call, so this is several requests:
   * if one fails midway the earlier ones stay saved, and the reload shows exactly what did.
   */
  private async saveRemote(remote: InventoryRemote, product: ProductDraft, drafts: VariantDraft[]): Promise<Id | null> {
    const tenantId = this.tenantId();
    const fields = { name: product.name, categoryId: product.categoryId, description: product.description };
    const fresh = (draft: VariantDraft): NewVariant => ({
      name: draft.name,
      sku: draft.sku,
      priceCents: draft.priceCents,
      lowStockThreshold: draft.lowStockThreshold,
      initialStock: draft.initialStock,
    });
    let productId = product.id;
    const saved = await this.attempt(async () => {
      if (!productId) {
        productId = await remote.createProduct(tenantId, { ...fields, stockMode: product.stockMode }, drafts.map(fresh));
        if (!product.active) await remote.setActive(tenantId, productId, false);
        return;
      }
      const current = this.productById().get(productId);
      await remote.updateProduct(tenantId, productId, fields);
      if (current && current.active !== product.active) await remote.setActive(tenantId, productId, product.active);
      for (const draft of drafts) {
        const variant = draft.id ? this.variantById().get(draft.id) : undefined;
        if (!variant) {
          await remote.addVariant(tenantId, productId, fresh(draft));
          continue;
        }
        const changed =
          variant.name !== draft.name || variant.sku !== draft.sku || variant.priceCents !== draft.priceCents || variant.lowStockThreshold !== draft.lowStockThreshold;
        if (changed) await remote.updateVariant(tenantId, { ...variant, ...fresh(draft) });
      }
    });
    await this.load(tenantId);
    return saved ? productId : null;
  }

  /** 'api' mode: runs a request and shows the server's reason when it fails. */
  private async attempt(work: () => Promise<void>): Promise<boolean> {
    try {
      await work();
      return true;
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      return false;
    }
  }

  /** Applies an analysed import ('mock' mode only): new SKUs create products/variants, known SKUs update price and stock. */
  applyImport(rows: ProductImportRow[]): { created: number; updated: number } {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      if (row.status === 'error' || row.priceCents === null) continue;
      const existing = this.variants().find((v) => v.sku === row.sku);
      if (existing) {
        this.variantTable.patch(existing.id, { priceCents: row.priceCents });
        if (row.stock !== null && row.stock !== existing.onHand && !movementError(existing, row.stock - existing.onHand)) {
          this.recordLocal(existing, 'adjustment', row.stock - existing.onHand, 'Importación desde archivo');
        }
        updated++;
        continue;
      }
      const productId =
        this.products().find((p) => p.name.toLowerCase() === row.product.toLowerCase())?.id ??
        this.saveLocal(
          {
            id: null,
            name: row.product,
            categoryId: this.categoryList.ensureLocal(row.category),
            category: row.category,
            description: '',
            photoDataUrl: null,
            stockMode: 'units',
            active: true,
          },
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
      if (row.stock) this.recordLocal(this.variantById().get(variantId)!, 'initial', row.stock, 'Importación desde archivo');
      created++;
    }
    return { created, updated };
  }
}
