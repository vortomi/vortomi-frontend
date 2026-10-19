import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { STOCK_STATUS } from '../../shared/api/labels';
import { formatUsdCents, formatVes } from '../../shared/format/money';
import { toCsv } from '../../shared/files/csv';
import { downloadText } from '../../shared/files/download';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Switch } from '../../shared/ui/switch';
import { Toaster } from '../../shared/ui/toaster';
import { type InventoryItem, InventoryData } from './inventory.data';
import { type StockStatus, toBolivares } from './inventory.rules';
import { ProductImportDialog } from './product-import.dialog';

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Products and stock of the company (documentations/05-inventario.md). */
@Component({
  selector: 'app-inventory-page',
  imports: [RouterLink, Icon, Pill, Switch, ProductImportDialog],
  templateUrl: './inventory.page.html',
  styleUrl: './inventory.page.scss',
})
export class InventoryPage {
  protected readonly data = inject(InventoryData);
  protected readonly session = inject(Session);
  private readonly workspace = inject(Workspace);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly statusLabel = STOCK_STATUS;
  protected readonly search = signal('');
  protected readonly category = signal('');
  protected readonly status = signal<StockStatus | ''>('');
  protected readonly importing = signal(false);

  protected readonly rate = computed(() => this.workspace.settings()?.exchangeRateVes ?? null);
  protected readonly rows = computed(() => {
    const needle = normalize(this.search());
    return this.data.items().filter(
      ({ product, variants, status }) =>
        (!this.category() || product.category === this.category()) &&
        (!this.status() || status === this.status()) &&
        (!needle || normalize(product.name).includes(needle) || variants.some((v) => v.sku.toLowerCase().includes(needle))),
    );
  });
  protected readonly counts = computed(() => ({
    out: this.data.items().filter((i) => i.status === 'out').length,
    low: this.data.items().filter((i) => i.status === 'low').length,
  }));

  protected price(item: InventoryItem): string {
    if (!item.range) return '—';
    const { min, max } = item.range;
    return min === max ? formatUsdCents(min) : `${formatUsdCents(min)} – ${formatUsdCents(max)}`;
  }

  protected priceVes(item: InventoryItem): string | null {
    const rate = this.rate();
    return rate && item.range ? `≈ ${formatVes(toBolivares(item.range.min, rate))}` : null;
  }

  protected rateLabel(rate: number): string {
    return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(rate);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected open(item: InventoryItem): void {
    void this.router.navigate(['/inventory', item.product.id]);
  }

  protected exportCsv(): void {
    const csv = toCsv(
      ['SKU', 'Producto', 'Categoría', 'Variante', 'Precio USD', 'Existencia', 'Apartadas'],
      this.rows().flatMap(({ product, variants }) =>
        variants.map((v) => [v.sku, product.name, product.category, v.name, (v.priceCents / 100).toFixed(2).replace('.', ','), String(v.onHand), String(v.reserved)]),
      ),
    );
    downloadText(`inventario-${this.session.tenant()?.slug ?? 'empresa'}.csv`, csv);
    this.toaster.show('Inventario exportado');
  }
}
