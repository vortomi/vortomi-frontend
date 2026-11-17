import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiFailure } from '../../core/api/api-error';
import type { Id } from '../../shared/api/models';
import { Confirm } from '../../shared/ui/confirm';
import { Icon } from '../../shared/ui/icon';
import { NumericInput } from '../../shared/ui/numeric-input';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { InventoryData } from './inventory.data';
import { plainQuantity, today } from './stock-set-form';
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
 * «Actualizar existencias» (mockup web-23): the shelf of every counted product at once. The person
 * writes what is there; only what differs is saved, each as an adjustment (the server takes the
 * difference against the shelf when saving, so a sale made meanwhile stays).
 */
@Component({
  selector: 'app-stock-count-page',
  imports: [RouterLink, Icon, NumericInput, Skeleton],
  template: `
    <header class="page-top">
      <h1>Actualizar existencias</h1>
      <span class="sub">Escribe cuántas hay de cada producto. Deja igual lo que no cambió.</span>
      <span class="spacer"></span>
      <a class="btn" routerLink="/inventory"><span>Salir sin guardar</span></a>
    </header>

    <div class="page-body">
      @if (!data.ready()) {
        <div class="card table-card"><app-skeleton kind="table" [rows]="6" [cols]="4" /></div>
      } @else if (!lines().length) {
        <div class="card empty-state"><app-icon name="tag" />Todavía no hay productos que se cuenten por unidades, kilos o litros.</div>
      } @else {
        <div class="card table-card">
          <table class="data-table">
            <thead><tr><th>Producto</th><th>Según Vortomi</th><th>Hay ahora</th><th>Diferencia</th></tr></thead>
            <tbody>
              @for (line of lines(); track line.variantId) {
                <tr [class.changed]="line.difference !== 0">
                  <td><b>{{ line.name }}</b></td>
                  <td>{{ number(line.onHand) }}</td>
                  <td>
                    <input class="input count" [class.same]="line.counted !== null && line.difference === 0" appNumeric="quantity" [decimals]="line.places" inputmode="decimal" [attr.aria-label]="'Hay ahora de ' + line.name"
                      [value]="typed().get(line.variantId) ?? plain(line.onHand)" (input)="type(line.variantId, $event)" />
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
          <app-icon name="check" class="ok" />
          <span class="summary"><b>{{ changes().length }} {{ changes().length === 1 ? 'producto cambia' : 'productos cambian' }}</b> · los otros quedan igual</span>
          <label class="reason-label">Motivo <input class="input reason" aria-label="Motivo" placeholder="Motivo (opcional)" [value]="shownReason()" (input)="ownReason.set(value($event))" /></label>
          <button type="button" class="btn btn--primary" [disabled]="!changes().length || invalid() || saving()" [attr.aria-busy]="saving()" (click)="save()">
            <span>Guardar</span>
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './inventory.page.scss',
  styles: `
    .count { width: 96px; border: 2px solid var(--color-primary); background: var(--color-surface); }
    .count.same { border: 1px solid var(--color-border); background: var(--color-input); color: var(--color-text-muted); }
    tr.changed td { background: color-mix(in srgb, var(--color-primary) 7%, transparent); }
    .up { color: var(--color-success); }
    .down { color: var(--color-danger); }
    .bad { color: var(--color-danger); font-size: 12.5px; }
    .muted { color: var(--color-text-muted); }
    .bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; margin-top: 12px; font-size: 13.5px;
      background: var(--color-primary-soft); border-color: var(--color-primary-soft); }
    .ok { color: var(--color-primary); --icon-size: 16px; }
    .summary { white-space: nowrap; }
    /* The reason takes the room left, so it is read whole; on a phone it goes to its own line. */
    .reason-label { flex: 1 1 280px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-muted); min-width: 0; }
    .reason { flex: 1; min-width: 0; }
  `,
})
export class StockCountPage {
  protected readonly data = inject(InventoryData);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly router = inject(Router);

  protected readonly number = formatNumber;
  protected readonly plain = plainQuantity;
  /** What the person typed per version; a version not typed keeps its shelf count. */
  protected readonly typed = signal<ReadonlyMap<Id, string>>(new Map());
  /** What the person wrote as reason; null while they leave the one Vortomi suggests. */
  protected readonly ownReason = signal<string | null>(null);
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
  /** The suggested reason, following what changes: «Actualización de 2 productos · 17 nov 2026». */
  private readonly autoReason = computed(() => {
    const count = this.changes().length;
    return count ? `Actualización de ${count} ${count === 1 ? 'producto' : 'productos'} · ${today()}` : '';
  });
  protected readonly shownReason = computed(() => this.ownReason() ?? this.autoReason());

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
      title: '¿Actualizar las existencias?',
      message: `Se ${changes.length === 1 ? 'registra 1 ajuste' : `registran ${changes.length} ajustes`}: ${summary}. Queda en el historial de cada producto, con tu nombre.`,
      confirmLabel: 'Guardar',
      action: async () => {
        const result = await this.data.recordCount(
          changes.map((l) => ({ variantId: l.variantId, counted: l.counted! })),
          this.shownReason().trim() || this.autoReason(),
        );
        if ('error' in result) throw new ApiFailure(0, 'count_refused', result.error);
        changed = result.changed;
      },
    });
    this.saving.set(false);
    if (!done) return;
    // Saved: nothing is pending any more, so leaving does not ask.
    this.typed.set(new Map());
    this.ownReason.set(null);
    this.toaster.show(changed === 1 ? 'Existencias actualizadas: 1 producto' : `Existencias actualizadas: ${changed} productos`);
    void this.router.navigateByUrl('/inventory');
  }
}
