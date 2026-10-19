import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { STOCK_STATUS } from '../../shared/api/labels';
import type { Id, StockMode, StockMovementKind } from '../../shared/api/models';
import { formatShortDate } from '../../shared/format/date-time';
import { formatUsdCents, formatVes } from '../../shared/format/money';
import { imageFileError, readAsDataUrl } from '../../shared/files/image';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { InventoryData, type VariantDraft } from './inventory.data';
import { MOVEMENT_LABEL, freeUnits, parsePriceCents, skuError, toBolivares, variantStatus } from './inventory.rules';

interface VariantRow {
  id: Id | null;
  name: string;
  sku: string;
  price: string;
  threshold: number;
  initialStock: number;
}

const PHOTO_MAX_BYTES = 800_000;
/** Kinds a person records by hand; "sale" also comes from paid orders later. */
const MANUAL_KINDS: StockMovementKind[] = ['purchase', 'sale', 'loss', 'return', 'adjustment'];
/** These always remove units: the person types how many, the sign is implied. */
const REMOVING: StockMovementKind[] = ['sale', 'loss'];

/** Create (/inventory/new) or edit (/inventory/:productId) a product. */
@Component({
  selector: 'app-product-detail-page',
  imports: [RouterLink, Icon, Pill],
  templateUrl: './product-detail.page.html',
  styleUrl: './product-detail.page.scss',
})
export class ProductDetailPage {
  protected readonly data = inject(InventoryData);
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

  protected readonly name = signal('');
  protected readonly category = signal('');
  protected readonly description = signal('');
  protected readonly photo = signal<string | null>(null);
  protected readonly stockMode = signal<StockMode>('units');
  protected readonly active = signal(true);
  protected readonly rows = signal<VariantRow[]>([]);
  protected readonly errors = signal<string[]>([]);

  protected readonly movement = signal({ variantId: '', kind: 'purchase' as StockMovementKind, quantity: 1, reason: '' });

  constructor() {
    // Reload the form only when the product changes (or data arrives), never on stock updates:
    // recording a movement must not wipe price edits the person has not saved yet.
    effect(() => {
      this.productId();
      if (!this.data.ready()) return;
      untracked(() => {
        const product = this.product();
        const variants = this.variants();
        this.name.set(product?.name ?? '');
        this.category.set(product?.category ?? '');
        this.description.set(product?.description ?? '');
        this.photo.set(product?.photoDataUrl ?? null);
        this.stockMode.set(product?.stockMode ?? 'units');
        this.active.set(product?.active ?? true);
        this.rows.set(
          variants.length
            ? variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, price: (v.priceCents / 100).toFixed(2).replace('.', ','), threshold: v.lowStockThreshold, initialStock: 0 }))
            : [{ id: null, name: 'Única', sku: '', price: '', threshold: 0, initialStock: 0 }],
        );
        this.movement.update((m) => ({ ...m, variantId: variants[0]?.id ?? '' }));
        this.errors.set([]);
      });
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected setRow(index: number, key: keyof VariantRow, event: Event): void {
    const raw = this.value(event);
    const value = key === 'threshold' || key === 'initialStock' ? Math.max(0, Math.floor(Number(raw) || 0)) : key === 'sku' ? raw.toUpperCase() : raw;
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  protected addRow(): void {
    this.rows.update((rows) => [...rows, { id: null, name: '', sku: '', price: '', threshold: 0, initialStock: 0 }]);
  }

  protected removeRow(index: number): void {
    const row = this.rows()[index];
    const variant = row?.id ? this.data.variantById().get(row.id) : undefined;
    if (variant && (variant.onHand > 0 || variant.reserved > 0)) {
      this.toaster.show('Tiene unidades en existencia: regístralas como merma o venta antes de quitarla.', 'info');
      return;
    }
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
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
    this.photo.set(await readAsDataUrl(file));
  }

  protected save(): void {
    const ownIds = new Set(this.rows().map((r) => r.id));
    const takenElsewhere = this.data.variants().filter((v) => !ownIds.has(v.id)).map((v) => v.sku);
    const problems: string[] = [];
    if (!this.name().trim()) problems.push('Escribe el nombre del producto.');
    if (!this.category().trim()) problems.push('Escribe la categoría.');
    if (!this.rows().length) problems.push('Agrega al menos una variante.');
    const seen: string[] = [];
    const drafts: VariantDraft[] = [];
    this.rows().forEach((row, i) => {
      const label = row.name || `Variante ${i + 1}`;
      const price = parsePriceCents(row.price);
      const skuProblem = skuError(row.sku, [...takenElsewhere, ...seen]);
      if (!row.name.trim()) problems.push(`${label}: escribe el nombre de la variante.`);
      if (skuProblem) problems.push(`${label}: ${skuProblem}`);
      if (price === null) problems.push(`${label}: precio no válido.`);
      seen.push(row.sku);
      if (price !== null) drafts.push({ id: row.id, name: row.name.trim(), sku: row.sku, priceCents: price, lowStockThreshold: row.threshold, initialStock: row.initialStock });
    });
    this.errors.set(problems);
    if (problems.length) return;

    const id = this.data.saveProduct(
      {
        id: this.product()?.id ?? null,
        name: this.name().trim(),
        category: this.category().trim(),
        description: this.description().trim(),
        photoDataUrl: this.photo(),
        stockMode: this.stockMode(),
        active: this.active(),
      },
      drafts,
    );
    this.toaster.show(this.isNew() ? 'Producto creado' : 'Producto guardado');
    if (this.isNew()) void this.router.navigate(['/inventory', id]);
  }

  protected setMovement(key: 'variantId' | 'kind' | 'quantity' | 'reason', event: Event): void {
    const raw = this.value(event);
    this.movement.update((m) => ({ ...m, [key]: key === 'quantity' ? Math.floor(Number(raw) || 0) : raw }));
  }

  protected record(): void {
    const { variantId, kind, quantity, reason } = this.movement();
    const signed = REMOVING.includes(kind) ? -Math.abs(quantity) : kind === 'adjustment' ? quantity : Math.abs(quantity);
    const error = this.data.recordMovement(variantId, kind, signed, reason);
    if (error) return this.toaster.show(error, 'info');
    this.movement.update((m) => ({ ...m, quantity: 1, reason: '' }));
    this.toaster.show('Movimiento registrado');
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
