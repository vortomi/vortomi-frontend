import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { ApiCategory, ApiList, ApiMovement, ApiProduct, ApiVariant, ApiVariantType } from '../../shared/api/contract';
import { toCategory, toMovement, toProduct, toVariant, toVariantType } from '../../shared/api/mappers';
import type { Id, Product, ProductCategory, ProductVariant, StockMovement, StockMovementKind, VariantOption, VariantType } from '../../shared/api/models';

/** A variant as it is created: the opening count becomes an 'initial' movement on the server. */
export type NewVariant = Pick<ProductVariant, 'optionId' | 'name' | 'sku' | 'priceCents' | 'lowStockThreshold'> & { initialStock: number };
export type ProductFields = Pick<Product, 'name' | 'categoryId' | 'variantTypeId' | 'description'>;

/**
 * Inventory against vortomi-backend ('api' mode). Everyone reads and sells; admins manage the
 * catalog (the server enforces it). Stock only changes through movements, never by writing it.
 */
@Injectable({ providedIn: 'root' })
export class InventoryRemote {
  private readonly api = inject(ApiClient);

  async list(tenantId: Id): Promise<{ products: Product[]; variants: ProductVariant[] }> {
    const list = await this.api.get<ApiList<ApiProduct>>(this.path(tenantId, 'products'));
    const mapped = list.items.map((row) => toProduct(tenantId, row));
    return { products: mapped.map((m) => m.product), variants: mapped.flatMap((m) => m.variants) };
  }

  async createProduct(tenantId: Id, fields: ProductFields & Pick<Product, 'stockMode'>, variants: NewVariant[]): Promise<Id> {
    const created = await this.api.post<{ id: Id }>(this.path(tenantId, 'products'), { ...fields, variants });
    return created.id;
  }

  updateProduct(tenantId: Id, productId: Id, fields: ProductFields): Promise<void> {
    return this.api.put(this.path(tenantId, `products/${encodeURIComponent(productId)}`), fields);
  }

  setActive(tenantId: Id, productId: Id, active: boolean): Promise<void> {
    return this.api.put(this.path(tenantId, `products/${encodeURIComponent(productId)}/active`), { active });
  }

  addVariant(tenantId: Id, productId: Id, variant: NewVariant): Promise<{ id: Id }> {
    return this.api.post(this.path(tenantId, `products/${encodeURIComponent(productId)}/variants`), variant);
  }

  async updateVariant(tenantId: Id, variant: ProductVariant): Promise<ProductVariant> {
    const { optionId, name, sku, priceCents, available, lowStockThreshold } = variant;
    const row = await this.api.put<ApiVariant>(this.variant(tenantId, variant.id), { optionId, name, sku, priceCents, available, lowStockThreshold });
    return toVariant(tenantId, row);
  }

  /** Records a movement and answers with the variant's new count. */
  async move(tenantId: Id, variantId: Id, kind: StockMovementKind, quantity: number, reason: string): Promise<ProductVariant> {
    const row = await this.api.post<ApiVariant>(`${this.variant(tenantId, variantId)}/movements`, { kind, quantity, reason });
    return toVariant(tenantId, row);
  }

  async history(tenantId: Id, variantId: Id): Promise<StockMovement[]> {
    const list = await this.api.get<ApiList<ApiMovement>>(`${this.variant(tenantId, variantId)}/movements`);
    return list.items.map((row) => toMovement(tenantId, variantId, row));
  }

  async categories(tenantId: Id): Promise<ProductCategory[]> {
    const list = await this.api.get<ApiList<ApiCategory>>(this.path(tenantId, 'categories'));
    return list.items.map((row) => toCategory(tenantId, row));
  }

  async createCategory(tenantId: Id, name: string): Promise<ProductCategory> {
    return toCategory(tenantId, await this.api.post<ApiCategory>(this.path(tenantId, 'categories'), { name }));
  }

  async updateCategory(tenantId: Id, id: Id, name: string): Promise<ProductCategory> {
    return toCategory(tenantId, await this.api.put<ApiCategory>(this.path(tenantId, `categories/${encodeURIComponent(id)}`), { name }));
  }

  removeCategory(tenantId: Id, id: Id): Promise<void> {
    return this.api.delete(this.path(tenantId, `categories/${encodeURIComponent(id)}`));
  }

  async variantTypes(tenantId: Id): Promise<{ types: VariantType[]; options: VariantOption[] }> {
    const list = await this.api.get<ApiList<ApiVariantType>>(this.path(tenantId, 'variant-types'));
    const mapped = list.items.map((row) => toVariantType(tenantId, row));
    return { types: mapped.map((m) => m.type), options: mapped.flatMap((m) => m.options) };
  }

  async createVariantType(tenantId: Id, name: string): Promise<VariantType> {
    return toVariantType(tenantId, await this.api.post<ApiVariantType>(this.path(tenantId, 'variant-types'), { name })).type;
  }

  async renameVariantType(tenantId: Id, id: Id, name: string): Promise<VariantType> {
    const row = await this.api.put<{ id: string; name: string }>(this.path(tenantId, `variant-types/${encodeURIComponent(id)}`), { name });
    return { id: row.id, tenantId, name: row.name };
  }

  removeVariantType(tenantId: Id, id: Id): Promise<void> {
    return this.api.delete(this.path(tenantId, `variant-types/${encodeURIComponent(id)}`));
  }

  async addVariantOption(tenantId: Id, typeId: Id, value: string): Promise<VariantOption> {
    const row = await this.api.post<{ id: string; value: string }>(this.path(tenantId, `variant-types/${encodeURIComponent(typeId)}/options`), { value });
    return { id: row.id, tenantId, typeId, value: row.value };
  }

  /** The server renames the variants that use it too. */
  async renameVariantOption(tenantId: Id, option: VariantOption, value: string): Promise<VariantOption> {
    const row = await this.api.put<{ id: string; value: string }>(this.path(tenantId, `variant-options/${encodeURIComponent(option.id)}`), { value });
    return { ...option, value: row.value };
  }

  removeVariantOption(tenantId: Id, id: Id): Promise<void> {
    return this.api.delete(this.path(tenantId, `variant-options/${encodeURIComponent(id)}`));
  }

  private variant(tenantId: Id, variantId: Id): string {
    return this.path(tenantId, `variants/${encodeURIComponent(variantId)}`);
  }

  private path(tenantId: Id, resource: string): string {
    return this.api.company(tenantId, `inventory/${resource}`);
  }
}
