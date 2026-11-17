import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { Id, Product, ProductVariant } from '../../shared/api/models';
import { NumericInput } from '../../shared/ui/numeric-input';
import { Toaster } from '../../shared/ui/toaster';
import { InventoryData } from './inventory.data';
import { formatNumber, parseQuantity, roundQuantity, takesDecimals } from './sale-units';

/** A quantity as it is typed back: no thousands dot (it would read as decimals), decimal comma. */
export const plainQuantity = (value: number) => String(roundQuantity(value)).replace('.', ',');

interface Line {
  variantId: Id;
  name: string;
  onHand: number;
  /** Set aside for unpaid quotes: on the shelf, but not free to sell. */
  reserved: number;
  counted: number | null;
  difference: number;
}

/**
 * How many there are now: how stock is changed by hand on the product page («Existencias»), like
 * «Actualizar existencias» for many at once (decided 17 Nov 2026). The person writes the new
 * amount («100» → «50») and the difference is saved as an adjustment, through the same stock count
 * as «Actualizar existencias» (the server takes it against the shelf at that moment).
 */
@Component({
  selector: 'app-stock-set-form',
  imports: [NumericInput],
  template: `
    @for (line of lines(); track line.variantId) {
      <label class="line">
        <span class="name">{{ line.name }}@if (line.reserved) {<small>{{ number(line.reserved) }} apartada{{ line.reserved === 1 ? '' : 's' }} en cotizaciones</small>}</span>
        <input class="input" appNumeric="quantity" [decimals]="places()" inputmode="decimal" [attr.aria-label]="'En el estante: ' + line.name"
          [value]="typed().get(line.variantId) ?? plain(line.onHand)" (input)="type(line.variantId, $event)" />
        @if (line.counted === null) {
          <span class="diff bad">Revisa</span>
        } @else if (line.difference === 0) {
          <span class="diff muted">Sin cambio</span>
        } @else {
          <b class="diff" [class.up]="line.difference > 0" [class.down]="line.difference < 0">{{ signed(line.difference) }}</b>
        }
      </label>
    }
    <input class="input" aria-label="Motivo" placeholder="Motivo (opcional): ej. conteo de la tarde" [value]="reason()" (input)="reason.set(value($event))" />
    <div class="actions">
      <button type="button" class="btn btn--primary" [disabled]="!changes().length || invalid() || saving()" [attr.aria-busy]="saving()" (click)="save()">
        <span>Guardar</span>
      </button>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 8px; }
    .line { display: grid; grid-template-columns: minmax(0, 1fr) 100px 70px; align-items: center; gap: 10px; }
    .name { font-size: 13px; min-width: 0; overflow-wrap: anywhere; }
    .name small { display: block; font-size: 11.5px; line-height: 1.3; color: var(--color-text-muted); }
    .diff { font-size: 12.5px; text-align: right; }
    .up { color: var(--color-success); }
    .down { color: var(--color-danger); }
    .bad { color: var(--color-danger); }
    .muted { color: var(--color-text-muted); }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
  `,
})
export class StockSetForm {
  readonly product = input.required<Product>();
  readonly variants = input.required<ProductVariant[]>();
  readonly saved = output<void>();

  private readonly data = inject(InventoryData);
  private readonly toaster = inject(Toaster);

  protected readonly plain = plainQuantity;
  protected readonly number = formatNumber;
  protected readonly typed = signal<ReadonlyMap<Id, string>>(new Map());
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly places = computed(() => (takesDecimals(this.product().saleUnit) ? 2 : 0));

  protected readonly lines = computed<Line[]>(() =>
    this.variants().map((v) => {
      const text = this.typed().get(v.id);
      const counted = text === undefined ? v.onHand : parseQuantity(text, this.product().saleUnit);
      return {
        variantId: v.id,
        name: this.variants().length > 1 ? v.name : 'En el estante',
        reserved: v.reserved,
        onHand: v.onHand,
        counted,
        difference: counted === null ? 0 : roundQuantity(counted - v.onHand),
      };
    }),
  );
  protected readonly changes = computed(() => this.lines().filter((l) => l.counted !== null && l.difference !== 0));
  protected readonly invalid = computed(() => this.lines().some((l) => l.counted === null));

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
    const result = await this.data.recordCount(
      changes.map((l) => ({ variantId: l.variantId, counted: l.counted! })),
      this.reason().trim() || 'Actualizado desde la lista',
    );
    this.saving.set(false);
    if ('error' in result) return this.toaster.show(result.error, 'info');
    // Saved: the fields show the shelf again (the new amount).
    this.typed.set(new Map());
    this.reason.set('');
    const line = changes[0]!;
    this.toaster.show(changes.length === 1 ? `${this.product().name}: ahora hay ${formatNumber(line.counted!)}` : 'Existencias actualizadas');
    this.saved.emit();
  }
}
