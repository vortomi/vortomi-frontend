import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiFailure } from '../../core/api/api-error';
import type { Id } from '../../shared/api/models';
import { formatShortDate } from '../../shared/format/date-time';
import { Confirm } from '../../shared/ui/confirm';
import { Icon } from '../../shared/ui/icon';
import { NumericInput } from '../../shared/ui/numeric-input';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { InventoryData } from './inventory.data';
import { formatNumber, parseQuantity, roundQuantity, takesDecimals } from './sale-units';

interface CountLine {
  variantId: Id;
  name: string;
  onHand: number;
  places: number;
  /** What the person counted, parsed; null while it is not a valid amount. */
  counted: number | null;
  difference: number;
}

/**
 * «Contar existencias» (mockup web-23): the shelf of every counted product at once. The person
 * writes what is there; only what differs is saved, each as an adjustment (the server takes the
 * difference against the shelf when saving, so a sale made meanwhile stays).
 */
@Component({
  selector: 'app-stock-count-page',
  imports: [RouterLink, Icon, NumericInput, Skeleton],
  template: `
    <header class="page-top">
      <a class="back" routerLink="/inventory" aria-label="Volver al inventario"><app-icon name="back" /></a>
      <h1>Contar existencias</h1>
      <span class="sub">Escribe lo que hay en el estante. Deja igual lo que no contaste.</span>
    </header>

    <div class="page-body">
      @if (!data.ready()) {
        <div class="card table-card"><app-skeleton kind="table" [rows]="6" [cols]="4" /></div>
      } @else if (!lines().length) {
        <div class="card empty-state"><app-icon name="tag" />Todavía no hay productos que se cuenten por unidades, kilos o litros.</div>
      } @else {
        <div class="card table-card">
          <table class="data-table">
            <thead><tr><th>Producto</th><th>Según Vortomi</th><th>Contaste</th><th>Diferencia</th></tr></thead>
            <tbody>
              @for (line of lines(); track line.variantId) {
                <tr [class.changed]="line.difference !== 0">
                  <td><b>{{ line.name }}</b></td>
                  <td>{{ number(line.onHand) }}</td>
                  <td>
                    <input class="input count" appNumeric="quantity" [decimals]="line.places" inputmode="decimal" [attr.aria-label]="'Contaste de ' + line.name"
                      [value]="typed().get(line.variantId) ?? number(line.onHand)" (input)="type(line.variantId, $event)" />
                  </td>
                  <td>
                    @if (line.counted === null) {
                      <span class="bad">Revisa la cantidad</span>
                    } @else if (line.difference === 0) {
                      <span class="muted">—</span>
                    } @else {
                      <b [class.up]="line.difference > 0" [class.down]="line.difference < 0">{{ signed(line.difference) }}</b>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="card bar">
          <span><b>{{ changes().length }} {{ changes().length === 1 ? 'producto cambia' : 'productos cambian' }}</b> · los otros quedan igual</span>
          <span class="spacer"></span>
          <input class="input reason" aria-label="Motivo" [value]="reason()" (input)="reason.set(value($event))" />
          <a class="btn" routerLink="/inventory"><span>Salir</span></a>
          <button type="button" class="btn btn--primary" [disabled]="!changes().length || invalid() || saving()" [attr.aria-busy]="saving()" (click)="save()">
            <span>Guardar conteo</span>
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './inventory.page.scss',
  styles: `
    .back { display: inline-flex; color: var(--color-text-muted); --icon-size: 20px; }
    .count { width: 110px; }
    tr.changed { background: var(--color-warning-soft); }
    .up { color: var(--color-success); }
    .down { color: var(--color-danger); }
    .bad { color: var(--color-danger); font-size: 12.5px; }
    .muted { color: var(--color-text-muted); }
    .bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; margin-top: 12px; font-size: 13.5px; }
    .spacer { flex: 1; }
    .reason { width: 220px; }
  `,
})
export class StockCountPage {
  protected readonly data = inject(InventoryData);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly router = inject(Router);

  protected readonly number = formatNumber;
  /** What the person typed per version; a version not typed keeps its shelf count. */
  protected readonly typed = signal<ReadonlyMap<Id, string>>(new Map());
  protected readonly reason = signal(`Conteo del ${formatShortDate(new Date().toISOString(), 'America/Caracas')}`);
  protected readonly saving = signal(false);

  protected readonly lines = computed<CountLine[]>(() =>
    this.data
      .items()
      .filter((item) => item.product.stockMode === 'units')
      .flatMap((item) =>
        item.variants.map((v): CountLine => {
          const unit = item.product.saleUnit;
          const text = this.typed().get(v.id);
          const counted = text === undefined ? v.onHand : parseQuantity(text, unit);
          return {
            variantId: v.id,
            name: item.variants.length > 1 ? `${item.product.name} · ${v.name}` : item.product.name,
            onHand: v.onHand,
            places: takesDecimals(unit) ? 2 : 0,
            counted,
            difference: counted === null ? 0 : roundQuantity(counted - v.onHand),
          };
        }),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  );
  protected readonly changes = computed(() => this.lines().filter((l) => l.counted !== null && l.difference !== 0));
  protected readonly invalid = computed(() => this.lines().some((l) => l.counted === null));
  private readonly dirty = computed(() => this.changes().length > 0);

  constructor() {
    inject(UnsavedChanges).track(this.dirty);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected type(variantId: Id, event: Event): void {
    const text = this.value(event);
    this.typed.update((map) => new Map(map).set(variantId, text));
  }

  protected signed(difference: number): string {
    return `${difference > 0 ? '+' : '−'}${formatNumber(Math.abs(difference))}`;
  }

  protected async save(): Promise<void> {
    const changes = this.changes();
    if (!changes.length || this.saving()) return;
    this.saving.set(true);
    const summary = changes.map((l) => `${l.name} ${this.signed(l.difference)} → ${formatNumber(l.counted!)}`).join(' · ');
    let changed = 0;
    const done = await this.confirm.ask({
      title: '¿Guardar el conteo?',
      message: `Se ${changes.length === 1 ? 'registra 1 ajuste' : `registran ${changes.length} ajustes`}: ${summary}. Queda en el historial de cada producto, con tu nombre.`,
      confirmLabel: 'Guardar',
      action: async () => {
        const result = await this.data.recordCount(
          changes.map((l) => ({ variantId: l.variantId, counted: l.counted! })),
          this.reason(),
        );
        if ('error' in result) throw new ApiFailure(0, 'count_refused', result.error);
        changed = result.changed;
      },
    });
    this.saving.set(false);
    if (!done) return;
    // Saved: nothing is pending any more, so leaving does not ask.
    this.typed.set(new Map());
    this.toaster.show(changed === 1 ? 'Conteo guardado: 1 producto ajustado' : `Conteo guardado: ${changed} productos ajustados`);
    void this.router.navigateByUrl('/inventory');
  }
}
