import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { STOCK_STATUS } from '../../shared/api/labels';
import type { Id, Product, ProductVariant, StockMode, StockMovementKind } from '../../shared/api/models';
import { formatShortDate } from '../../shared/format/date-time';
import { formatUsdCents, formatVes } from '../../shared/format/money';
import { imageFileError, readAsDataUrl } from '../../shared/files/image';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { CategoriesData } from './categories.data';
import { InventoryData, type VariantDraft } from './inventory.data';
import { MOVEMENT_LABEL, freeUnits, parsePriceCents, skuError, toBolivares, variantStatus } from './inventory.rules';
import { VariantTypesData } from './variant-types.data';

interface VariantRow {
  id: Id | null;
  /** A value of the product's type; empty while none is chosen. */
  optionId: Id | '';
  /** Used when the product has no type. */
  name: string;
  sku: string;
  price: string;
  threshold: number;
  initialStock: number;
}

/** Everything the edit form holds; empty ids mean "none chosen". */
interface ProductForm {
  name: string;
  categoryId: Id | '';
  variantTypeId: Id | '';
  description: string;
  photo: string | null;
  stockMode: StockMode;
  active: boolean;
  rows: VariantRow[];
}

const PHOTO_MAX_BYTES = 800_000;
/** Kinds a person records by hand; "sale" also comes from paid orders later. */
const MANUAL_KINDS: StockMovementKind[] = ['purchase', 'sale', 'loss', 'return', 'adjustment'];
/** These always remove units: the person types how many, the sign is implied. */
const REMOVING: StockMovementKind[] = ['sale', 'loss'];

const emptyRow = (name = ''): VariantRow => ({ id: null, optionId: '', name, sku: '', price: '', threshold: 0, initialStock: 0 });

function formOf(product: Product | null, variants: ProductVariant[]): ProductForm {
  return {
    name: product?.name ?? '',
    categoryId: product?.categoryId ?? '',
    variantTypeId: product?.variantTypeId ?? '',
    description: product?.description ?? '',
    photo: product?.photoDataUrl ?? null,
    stockMode: product?.stockMode ?? 'units',
    active: product?.active ?? true,
    rows: variants.length
      ? variants.map((v) => ({
          id: v.id,
          optionId: v.optionId ?? '',
          name: v.name,
          sku: v.sku,
          price: (v.priceCents / 100).toFixed(2).replace('.', ','),
          threshold: v.lowStockThreshold,
          initialStock: 0,
        }))
      : [emptyRow('Única')],
  };
}

/**
 * Create (/inventory/new) or see and edit (/inventory/:productId) a product. An existing
 * product opens read-only; «Editar» enables the form and only «Guardar» keeps the changes.
 */
@Component({
  selector: 'app-product-detail-page',
  imports: [RouterLink, Icon, Pill],
  templateUrl: './product-detail.page.html',
  styleUrl: './product-detail.page.scss',
})
export class ProductDetailPage {
  protected readonly data = inject(InventoryData);
  protected readonly categories = inject(CategoriesData);
  protected readonly variantTypes = inject(VariantTypesData);
  protected readonly session = inject(Session);
  private readonly workspace = inject(Workspace);
  private readonly directory = inject(Directory);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  readonly productId = input<string>();

  protected readonly product = computed(() => this.data.productById().get(this.productId() ?? '') ?? null);
  protected readonly isNew = computed(() => !this.productId());
  protected readonly canEdit = computed(() => this.session.isTenantAdmin());
  protected readonly variants = computed(() => this.data.variants().filter((v) => v.productId === this.productId()));
  protected readonly movements = computed(() => (this.productId() ? this.data.movementsOf(this.productId()!) : []));
  protected readonly rate = computed(() => this.workspace.settings()?.exchangeRateVes ?? null);
  protected readonly statusLabel = STOCK_STATUS;
  protected readonly kindLabel = MOVEMENT_LABEL;
  protected readonly manualKinds = MANUAL_KINDS;

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
  /** The type cannot change while its saved variants use its values. */
  protected readonly typeLocked = computed(() => !this.isNew() && this.variants().some((v) => v.optionId));
  protected readonly typeOptions = computed(() => this.variantTypes.typeById().get(this.form().variantTypeId)?.options ?? []);

  protected readonly movement = signal({ variantId: '', kind: 'purchase' as StockMovementKind, quantity: 1, reason: '' });
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

  /** Another type means other values: the rows choose again. */
  protected setType(event: Event): void {
    const variantTypeId = this.value(event);
    this.patch({ variantTypeId, rows: this.form().rows.map((r) => ({ ...r, optionId: '' })) });
  }

  protected setRow(index: number, key: keyof VariantRow, event: Event): void {
    const raw = this.value(event);
    const value = key === 'threshold' || key === 'initialStock' ? Math.max(0, Math.floor(Number(raw) || 0)) : key === 'sku' ? raw.toUpperCase() : raw;
    this.patch({ rows: this.form().rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)) });
  }

  /** Values another row of this product already uses: a product never repeats one. */
  protected takenBy(index: number): Set<Id> {
    return new Set(this.form().rows.filter((r, i) => i !== index && r.optionId).map((r) => r.optionId));
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
      this.toaster.show('Tiene unidades en existencia: regístralas como merma o venta antes de quitarla.', 'info');
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
        variantTypeId: f.variantTypeId || null,
        description: f.description.trim(),
        photoDataUrl: f.photo,
        stockMode: f.stockMode,
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
    const options = this.variantTypes.optionById();
    const problems: string[] = [];
    if (!f.name.trim()) problems.push('Escribe el nombre del producto.');
    if (!this.categories.byId().has(f.categoryId)) problems.push('Elige la categoría.');
    if (!f.rows.length) problems.push('Agrega al menos una variante.');
    const seen: string[] = [];
    const drafts: VariantDraft[] = [];
    f.rows.forEach((row, i) => {
      const name = f.variantTypeId ? (options.get(row.optionId)?.value ?? '') : row.name.trim();
      const label = name || `Variante ${i + 1}`;
      const price = parsePriceCents(row.price);
      const skuProblem = skuError(row.sku, [...takenElsewhere, ...seen]);
      if (f.variantTypeId && !options.has(row.optionId)) problems.push(`${label}: elige su valor.`);
      if (!f.variantTypeId && !name) problems.push(`${label}: escribe el nombre de la variante.`);
      if (skuProblem) problems.push(`${label}: ${skuProblem}`);
      if (price === null) problems.push(`${label}: precio no válido.`);
      seen.push(row.sku);
      if (price !== null) {
        drafts.push({
          id: row.id,
          optionId: f.variantTypeId ? row.optionId || null : null,
          name,
          sku: row.sku,
          priceCents: price,
          lowStockThreshold: row.threshold,
          initialStock: row.initialStock,
        });
      }
    });
    return { problems, drafts };
  }

  protected setMovement(key: 'variantId' | 'kind' | 'quantity' | 'reason', event: Event): void {
    const raw = this.value(event);
    this.movement.update((m) => ({ ...m, [key]: key === 'quantity' ? Math.floor(Number(raw) || 0) : raw }));
  }

  protected async record(): Promise<void> {
    const { variantId, kind, quantity, reason } = this.movement();
    const signed = REMOVING.includes(kind) ? -Math.abs(quantity) : kind === 'adjustment' ? quantity : Math.abs(quantity);
    const error = await this.data.recordMovement(variantId, kind, signed, reason);
    if (error) return this.toaster.show(error, 'info');
    this.movement.update((m) => ({ ...m, quantity: 1, reason: '' }));
    this.toaster.show('Movimiento registrado');
  }

  protected categoryName(id: Id | ''): string {
    return this.categories.byId().get(id)?.name ?? 'Sin categoría';
  }

  protected typeName(id: Id | ''): string {
    return this.variantTypes.typeById().get(id)?.type.name ?? 'Sin tipo: nombre libre';
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

  protected money(cents: number): string {
    const rate = this.rate();
    return rate ? `${formatUsdCents(cents)} · ${formatVes(toBolivares(cents, rate))}` : formatUsdCents(cents);
  }

  protected free = freeUnits;
  protected status = variantStatus;
}
