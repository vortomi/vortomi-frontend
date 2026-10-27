import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import { STOCK_STATUS } from '../../shared/api/labels';
import type { CustomValues, Id, Product, ProductVariant, SaleUnit, StockMode, StockMovementKind } from '../../shared/api/models';
import { formatShortDate } from '../../shared/format/date-time';
import { formatUsdCents, formatVes } from '../../shared/format/money';
import { imageFileError, readAsDataUrl } from '../../shared/files/image';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { appliesTo, cleanValues, formatValue, missingRequired } from '../custom-fields/custom-field-rules';
import { CustomFields } from '../custom-fields/custom-fields.data';
import { CustomValuesForm } from '../custom-fields/custom-values-form';
import { ExchangeRates } from '../exchange-rates/exchange-rates.data';
import { CategoriesData } from './categories.data';
import { InventoryData, type VariantDraft } from './inventory.data';
import { MOVEMENT_LABEL, freeUnits, parsePriceCents, skuError, toBolivares, variantStatus } from './inventory.rules';
import { SaleUnitPicker, type SaleSettings } from './sale-unit-picker';
import { SALE_UNIT, formatNumber, formatQuantity, parseQuantity, perUnit, takesDecimals } from './sale-units';
import { addValue, dropValue } from './variant-combinations';
import { VariantTypesData } from './variant-types.data';

interface VariantRow {
  id: Id | null;
  /** One value of each of the product's types, in order; empty for a variant named freely. */
  optionIds: Id[];
  /** Used when the product has no types. */
  name: string;
  sku: string;
  price: string;
  /** Typed as text: "2,5" for a product sold by the kilo. */
  threshold: string;
  initialStock: string;
}

/** Everything the edit form holds; empty ids mean "none chosen". */
interface ProductForm extends SaleSettings {
  name: string;
  /** «¿Viene en varias versiones?»: no means a single variant, «Única», with nothing else to decide. */
  versions: boolean;
  categoryId: Id | '';
  /** Up to three types combined, in order. */
  variantTypeIds: Id[];
  /** The values picked for each type, in the same order: their combinations are the rows. */
  picked: Id[][];
  description: string;
  photo: string | null;
  stockMode: StockMode;
  active: boolean;
  rows: VariantRow[];
  /** The company's own data about it ("Sirve para", "Marca"). */
  customValues: CustomValues;
}

const PHOTO_MAX_BYTES = 800_000;
const MAX_TYPES = 3;
/** Kinds a person records by hand; "sale" also comes from paid orders later. */
const MANUAL_KINDS: StockMovementKind[] = ['purchase', 'sale', 'loss', 'return', 'adjustment'];
/** These always remove: the person types how much, the sign is implied. */
const REMOVING: StockMovementKind[] = ['sale', 'loss'];

const emptyRow = (name = '', optionIds: Id[] = []): VariantRow => ({ id: null, optionIds, name, sku: '', price: '', threshold: '0', initialStock: '0' });

/** The values each type uses in the rows, in the rows' order. */
const pickedOf = (typeIds: Id[], rows: VariantRow[]): Id[][] => typeIds.map((_, i) => [...new Set(rows.map((r) => r.optionIds[i]).filter((id): id is Id => !!id))]);

function formOf(product: Product | null, variants: ProductVariant[]): ProductForm {
  const typeIds = product?.variantTypeIds ?? [];
  const rows: VariantRow[] = variants.length
    ? variants.map((v) => ({
        id: v.id,
        optionIds: v.optionIds,
        name: v.name,
        sku: v.sku,
        price: (v.priceCents / 100).toFixed(2).replace('.', ','),
        threshold: formatNumber(v.lowStockThreshold),
        initialStock: '0',
      }))
    : [emptyRow('Única')];
  return {
    name: product?.name ?? '',
    versions: typeIds.length > 0 || rows.length > 1,
    categoryId: product?.categoryId ?? '',
    variantTypeIds: typeIds,
    picked: pickedOf(typeIds, rows),
    description: product?.description ?? '',
    photo: product?.photoDataUrl ?? null,
    stockMode: product?.stockMode ?? 'units',
    saleUnit: product?.saleUnit ?? 'unit',
    minQuantity: product?.minQuantity ?? 1,
    quantityStep: product?.quantityStep ?? 1,
    active: product?.active ?? true,
    rows,
    customValues: product?.customValues ?? {},
  };
}

/**
 * Create (/inventory/new) or see and edit (/inventory/:productId) a product. An existing
 * product opens read-only; «Editar» enables the form and only «Guardar» keeps the changes.
 */
@Component({
  selector: 'app-product-detail-page',
  imports: [RouterLink, Icon, Pill, SaleUnitPicker, CustomValuesForm],
  templateUrl: './product-detail.page.html',
  styleUrl: './product-detail.page.scss',
})
export class ProductDetailPage {
  protected readonly data = inject(InventoryData);
  protected readonly categories = inject(CategoriesData);
  protected readonly variantTypes = inject(VariantTypesData);
  private readonly customFields = inject(CustomFields);
  protected readonly session = inject(Session);
  private readonly directory = inject(Directory);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  readonly productId = input<string>();

  protected readonly product = computed(() => this.data.productById().get(this.productId() ?? '') ?? null);
  protected readonly isNew = computed(() => !this.productId());
  protected readonly canEdit = computed(() => this.session.isTenantAdmin());
  protected readonly variants = computed(() => this.data.variants().filter((v) => v.productId === this.productId()));
  protected readonly movements = computed(() => (this.productId() ? this.data.movementsOf(this.productId()!) : []));
  protected readonly rate = inject(ExchangeRates).current;
  protected readonly statusLabel = STOCK_STATUS;
  protected readonly kindLabel = MOVEMENT_LABEL;
  protected readonly manualKinds = MANUAL_KINDS;
  protected readonly unitText = SALE_UNIT;
  protected readonly number = formatNumber;

  /** What is saved; the form starts from it and «Cancelar» goes back to it. */
  private readonly saved = computed(() => formOf(this.product(), this.variants()));
  protected readonly form = signal<ProductForm>(formOf(null, []));
  private readonly editingExisting = signal(false);
  /** A new product is always being edited; an existing one after «Editar». */
  protected readonly editing = computed(() => this.isNew() || this.editingExisting());
  protected readonly saving = signal(false);
  protected readonly errors = signal<string[]>([]);
  private readonly dirty = computed(() => this.editing() && JSON.stringify(this.form()) !== JSON.stringify(this.saved()));

  /** On the server a product keeps the stock mode it was created with. */
  protected readonly stockModeLocked = computed(() => this.data.onServer && !this.isNew());
  /** The types cannot change while saved variants use their values. */
  protected readonly typesLocked = computed(() => !this.isNew() && this.variants().some((v) => v.optionIds.length));
  /** One select per chosen type, plus an empty one to add another (up to three). */
  protected readonly typeSlots = computed(() => {
    const ids = this.form().variantTypeIds;
    return ids.length < MAX_TYPES && !this.typesLocked() ? [...ids, ''] : ids;
  });
  /** Every product field the company has; none: the section is not shown. */
  protected readonly hasFields = computed(() => this.customFields.products().length > 0);
  /** The company's fields for this product's category (those without categories go everywhere). */
  protected readonly productFields = computed(() => this.customFields.products().filter((f) => appliesTo(f, this.form().categoryId || null)));
  protected readonly formatValue = formatValue;

  /** Values a saved variant uses: they stay picked (a saved variant is never deleted from here). */
  private readonly savedValues = computed(() => new Set(this.variants().flatMap((v) => v.optionIds)));

  protected readonly movement = signal({ variantId: '', kind: 'purchase' as StockMovementKind, quantity: '1', reason: '' });
  /** The form was filled once: from then on, while editing, only the person changes it. */
  private filled = false;

  constructor() {
    inject(UnsavedChanges).track(this.dirty);
    // 'api' mode: the history is read when the product opens, not with the whole catalog.
    effect(() => {
      const id = this.productId();
      if (id && this.data.ready()) untracked(() => void this.data.loadMovements(id));
    });
    // While reading, the view follows what is saved (it may arrive after the page opens).
    // While editing it never does: a stock movement must not wipe changes not saved yet.
    effect(() => {
      const saved = this.saved();
      if (!this.data.ready() || (this.filled && untracked(this.editing))) return;
      this.filled = true;
      untracked(() => {
        this.form.set(saved);
        this.errors.set([]);
        if (!this.movement().variantId) this.movement.update((m) => ({ ...m, variantId: this.variants()[0]?.id ?? '' }));
      });
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected patch(change: Partial<ProductForm>): void {
    this.form.update((f) => ({ ...f, ...change }));
  }

  protected setSale(sale: SaleSettings): void {
    this.patch(sale);
  }

  /**
   * Choosing, changing or removing a type («''») changes which values tell variants apart: the
   * values are picked again and the new rows start over. Saved rows always stay.
   */
  protected setType(slot: number, event: Event): void {
    const chosen = this.value(event);
    const current = this.form().variantTypeIds;
    const variantTypeIds = chosen ? [...current.slice(0, slot), chosen, ...current.slice(slot + 1)] : current.filter((_, i) => i !== slot);
    this.patch({ variantTypeIds, picked: variantTypeIds.map(() => []), rows: this.form().rows.filter((r) => r.id !== null) });
  }

  /**
   * «Una sola» keeps one plain variant and nothing to decide; «Varias» opens the types and values.
   * Saved versions are never merged: a product with several saved ones stays with several.
   */
  protected setVersions(versions: boolean): void {
    const f = this.form();
    if (versions === f.versions) return;
    if (versions) {
      // A blank «Única» gives way to the versions the person builds; one with data stays.
      const only = f.rows.length === 1 ? f.rows[0]! : null;
      const blank = only && only.id === null && !only.sku && !only.price;
      this.patch({ versions, rows: blank ? [] : f.rows });
      return;
    }
    const saved = f.rows.filter((r) => r.id !== null);
    if (saved.length > 1 || this.typesLocked()) {
      this.toaster.show('Ya tiene varias versiones guardadas: no se pueden juntar en una sola.', 'info');
      return;
    }
    const keep = saved[0] ?? f.rows[0] ?? emptyRow();
    this.patch({ versions, variantTypeIds: [], picked: [], rows: [{ ...keep, optionIds: [], name: keep.id ? keep.name : 'Única' }] });
  }

  /** Types already chosen in another slot are not offered again. */
  protected typeChoices(slot: number) {
    const others = new Set(this.form().variantTypeIds.filter((_, i) => i !== slot));
    return this.variantTypes.list().filter((t) => !others.has(t.type.id));
  }

  protected optionsOf(typeId: Id) {
    return this.variantTypes.typeById().get(typeId)?.options ?? [];
  }

  protected isPicked(typeIndex: number, optionId: Id): boolean {
    return this.form().picked[typeIndex]?.includes(optionId) ?? false;
  }

  protected isSavedValue(optionId: Id): boolean {
    return this.savedValues().has(optionId);
  }

  /** Picking a value adds its combinations; dropping it takes away the new rows that use it. */
  protected toggleValue(typeIndex: number, optionId: Id): void {
    const f = this.form();
    const on = this.isPicked(typeIndex, optionId);
    if (on && this.isSavedValue(optionId)) return;
    const picked = f.picked.map((list, i) => (i !== typeIndex ? list : on ? list.filter((id) => id !== optionId) : [...list, optionId]));
    const rows = on ? dropValue(f.rows, typeIndex, optionId) : addValue(f.rows, picked, typeIndex, optionId, (ids) => emptyRow('', ids));
    this.patch({ picked, rows });
  }

  /** "M / Rojo": the row's values, or its typed name. */
  protected rowName(row: VariantRow): string {
    const options = this.variantTypes.optionById();
    return row.optionIds.length ? row.optionIds.map((id) => options.get(id)?.value ?? '?').join(' / ') : row.name;
  }

  protected setRow(index: number, key: keyof VariantRow, event: Event): void {
    const raw = this.value(event);
    const value = key === 'sku' ? raw.toUpperCase() : raw;
    this.patch({ rows: this.form().rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)) });
  }

  protected addRow(): void {
    this.patch({ rows: [...this.form().rows, emptyRow()] });
  }

  protected removeRow(index: number): void {
    const row = this.form().rows[index];
    const variant = row?.id ? this.data.variantById().get(row.id) : undefined;
    if (variant && this.data.onServer) {
      this.toaster.show('Una variante guardada no se borra: su historial de movimientos se conserva. Si ya no la vendes, deja su existencia en 0.', 'info');
      return;
    }
    if (variant && (variant.onHand > 0 || variant.reserved > 0)) {
      this.toaster.show('Tiene existencia: regístrala como merma o venta antes de quitarla.', 'info');
      return;
    }
    this.patch({ rows: this.form().rows.filter((_, i) => i !== index) });
  }

  protected async onPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const error = imageFileError(file, PHOTO_MAX_BYTES);
    if (error) {
      input.value = '';
      return this.toaster.show(error, 'info');
    }
    this.patch({ photo: await readAsDataUrl(file) });
  }

  protected edit(): void {
    this.form.set(this.saved());
    this.errors.set([]);
    this.editingExisting.set(true);
  }

  protected cancel(): void {
    if (this.isNew()) {
      void this.router.navigate(['/inventory']);
      return;
    }
    this.form.set(this.saved());
    this.errors.set([]);
    this.editingExisting.set(false);
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    const f = this.form();
    const { problems, drafts } = this.validate(f);
    this.errors.set(problems);
    if (problems.length) return;

    this.saving.set(true);
    const id = await this.data.saveProduct(
      {
        id: this.product()?.id ?? null,
        name: f.name.trim(),
        categoryId: f.categoryId || null,
        category: this.categories.byId().get(f.categoryId)?.name ?? '',
        variantTypeIds: f.variantTypeIds,
        description: f.description.trim(),
        photoDataUrl: f.photo,
        stockMode: f.stockMode,
        saleUnit: f.saleUnit,
        minQuantity: f.minQuantity,
        quantityStep: f.quantityStep,
        customValues: cleanValues(this.customFields.products(), f.customValues, f.categoryId || null),
        active: f.active,
      },
      drafts,
    );
    this.saving.set(false);
    if (!id) return;
    const created = this.isNew();
    this.editingExisting.set(false);
    // What was just saved is now the reference, so leaving does not ask about changes.
    this.form.set(this.saved());
    this.toaster.show(created ? 'Producto creado' : 'Producto guardado');
    if (created) void this.router.navigate(['/inventory', id]);
  }

  private validate(f: ProductForm): { problems: string[]; drafts: VariantDraft[] } {
    const ownIds = new Set(f.rows.map((r) => r.id));
    const takenElsewhere = this.data.variants().filter((v) => !ownIds.has(v.id)).map((v) => v.sku);
    const typed = f.variantTypeIds.length > 0;
    const problems: string[] = [];
    if (!f.name.trim()) problems.push('Escribe el nombre del producto.');
    if (!this.categories.byId().has(f.categoryId)) problems.push('Elige la categoría.');
    if (!f.rows.length) problems.push(typed ? 'Marca al menos un valor de cada clase.' : 'Agrega al menos una versión.');
    problems.push(...missingRequired(this.customFields.products(), f.customValues, f.categoryId || null));
    const amountHint = takesDecimals(f.saleUnit) ? 'un número de 0 o más, con hasta 3 decimales' : 'un número entero de 0 o más';
    const seen: string[] = [];
    const drafts: VariantDraft[] = [];
    f.rows.forEach((row, i) => {
      const name = this.rowName(row).trim();
      const label = name || `Versión ${i + 1}`;
      const price = parsePriceCents(row.price);
      const threshold = parseQuantity(row.threshold || '0', f.saleUnit);
      const initialStock = parseQuantity(row.initialStock || '0', f.saleUnit);
      const skuProblem = skuError(row.sku, [...takenElsewhere, ...seen]);
      // A saved variant from before the product had types keeps its typed name.
      if (typed && row.id === null && row.optionIds.length !== f.variantTypeIds.length) problems.push(`${label}: le falta un valor.`);
      if (!name) problems.push(`${label}: escribe el nombre de la versión.`);
      if (skuProblem) problems.push(`${label}: ${skuProblem}`);
      if (price === null) problems.push(`${label}: precio no válido.`);
      if (threshold === null) problems.push(`${label}: «Avisar cuando queden» debe ser ${amountHint}.`);
      if (initialStock === null) problems.push(`${label}: la cantidad inicial debe ser ${amountHint}.`);
      seen.push(row.sku);
      if (price !== null && threshold !== null && initialStock !== null) {
        drafts.push({ id: row.id, optionIds: row.optionIds, name, sku: row.sku, priceCents: price, lowStockThreshold: threshold, initialStock });
      }
    });
    return { problems, drafts };
  }

  protected setMovement(key: 'variantId' | 'kind' | 'quantity' | 'reason', event: Event): void {
    const raw = this.value(event);
    this.movement.update((m) => ({ ...m, [key]: raw }));
  }

  protected async record(): Promise<void> {
    const { variantId, kind, quantity, reason } = this.movement();
    const unit = this.product()?.saleUnit ?? 'unit';
    const negative = quantity.trim().startsWith('-');
    const amount = parseQuantity(quantity.trim().replace(/^-/, ''), unit);
    if (!amount) {
      return this.toaster.show(takesDecimals(unit) ? 'Escribe una cantidad mayor que cero, con hasta 3 decimales.' : 'Escribe una cantidad entera mayor que cero.', 'info');
    }
    const signed = REMOVING.includes(kind) ? -amount : kind === 'adjustment' && negative ? -amount : amount;
    const error = await this.data.recordMovement(variantId, kind, signed, reason);
    if (error) return this.toaster.show(error, 'info');
    this.movement.update((m) => ({ ...m, quantity: '1', reason: '' }));
    this.toaster.show('Movimiento registrado');
  }

  protected categoryName(id: Id | ''): string {
    return this.categories.byId().get(id)?.name ?? 'Sin categoría';
  }

  protected typeName(id: Id | ''): string {
    return this.variantTypes.typeById().get(id)?.type.name ?? '';
  }

  /** "Por Talla × Color", "Una sola" or "Con nombre propio". */
  protected versionsSummary(f: ProductForm): string {
    if (!f.versions) return 'Una sola';
    return f.variantTypeIds.length ? `Por ${f.variantTypeIds.map((id) => this.typeName(id)).join(' × ')}` : 'Varias, cada una con su nombre';
  }

  /** "Kilo · desde 0,5 kg, de 0,5 en 0,5" */
  protected saleSummary(f: SaleSettings): string {
    const label = SALE_UNIT[f.saleUnit].label;
    if (!takesDecimals(f.saleUnit)) return f.minQuantity > 1 ? `${label} · desde ${formatQuantity(f.minQuantity, f.saleUnit)}` : label;
    return `${label} · desde ${formatQuantity(f.minQuantity, f.saleUnit)}, de ${formatNumber(f.quantityStep)} en ${formatNumber(f.quantityStep)}`;
  }

  protected variantName(id: Id): string {
    return this.data.variantById().get(id)?.name ?? '—';
  }

  protected userName(id: Id): string {
    return this.directory.userById().get(id)?.name ?? '—';
  }

  protected date(iso: string): string {
    return formatShortDate(iso, this.session.timezone());
  }

  /** "$4,50 el kilo · 3.992,86 Bs" */
  protected money(cents: number): string {
    const rate = this.rate();
    const per = perUnit(this.unit());
    const usd = per ? `${formatUsdCents(cents)} ${per}` : formatUsdCents(cents);
    return rate ? `${usd} · ${formatVes(toBolivares(cents, rate))}` : usd;
  }

  /** "12,5 kg", in the product's unit. */
  protected qty(value: number): string {
    return formatQuantity(value, this.unit());
  }

  private unit(): SaleUnit {
    return this.product()?.saleUnit ?? this.form().saleUnit;
  }

  protected free = freeUnits;
  protected status = variantStatus;
}
