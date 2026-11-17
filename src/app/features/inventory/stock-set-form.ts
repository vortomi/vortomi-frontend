import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { Id, Product, ProductVariant } from '../../shared/api/models';
import { formatShortDate } from '../../shared/format/date-time';
import { NumericInput } from '../../shared/ui/numeric-input';
import { Toaster } from '../../shared/ui/toaster';
import { InventoryData } from './inventory.data';
import { SALE_UNIT, formatNumber, parseQuantity, roundQuantity, takesDecimals } from './sale-units';

/** A quantity as it is typed back: no thousands dot (it would read as decimals), decimal comma. */
export const plainQuantity = (value: number) => String(roundQuantity(value)).replace('.', ',');

/** Today, as the stock history shows it: «17 nov 2026». */
export const today = () => formatShortDate(new Date().toISOString(), 'America/Caracas');

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
 * «Existencias» of the product page: how many there are now. The person writes the new amount
 * («50» → «30») and the difference is saved as an adjustment, through the same stock update as
 * «Actualizar existencias» (the server takes it against the shelf at that moment). Its reason
 * follows what changes («De 50 a 30 · 17 nov 2026») until the person writes their own.
 */
@Component({
  selector: 'app-stock-set-form',
  imports: [NumericInput],
  template: `
    <p class="ask">¿Cuántas hay ahora?</p>
    @for (line of lines(); track line.variantId) {
      <div class="line">
        @if (several()) {
          <span class="name">{{ line.name }}</span>
        }
        <label class="qty">
          <input class="input" appNumeric="quantity" [decimals]="places()" inputmode="decimal" [attr.aria-label]="'Hay ahora de ' + line.name"
            [value]="typed().get(line.variantId) ?? plain(line.onHand)" (input)="type(line.variantId, $event)" />
          <span class="unit">{{ unit() }}</span>
        </label>
        @if (line.counted === null) {
          <span class="diff bad">Revisa</span>
        } @else if (line.difference !== 0) {
          <b class="diff" [class.up]="line.difference > 0" [class.down]="line.difference < 0">{{ signed(line.difference) }}</b>
        }
      </div>
      @if (line.reserved) {
        <p class="note">{{ number(line.reserved) }} apartada{{ line.reserved === 1 ? '' : 's' }} en cotizaciones sin pagar.</p>
      }
    }
    <input class="input" aria-label="Motivo" placeholder="Motivo (opcional)" [value]="shownReason()" (input)="ownReason.set(value($event))" />
    <button type="button" class="btn btn--primary save" [disabled]="!changes().length || invalid() || saving()" [attr.aria-busy]="saving()" (click)="save()">
      <span>Guardar</span>
    </button>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; }
    .ask { font-size: 13.5px; font-weight: 600; }
    .line { display: flex; align-items: center; gap: 10px; }
    .name { flex: 1; min-width: 0; font-size: 13px; overflow-wrap: anywhere; }
    .qty { display: flex; align-items: center; gap: 8px; }
    .qty .input { width: 110px; }
    .unit { font-size: 13px; color: var(--color-text-muted); }
    .diff { margin-left: auto; font-size: 13px; }
    .up { color: var(--color-success); }
    .down { color: var(--color-danger); }
    .bad { color: var(--color-danger); font-weight: 500; }
    .note { font-size: 12px; color: var(--color-text-muted); margin-top: -4px; }
    .save { width: 100%; justify-content: center; }
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
  /** What the person wrote as reason; null while they leave the one Vortomi suggests. */
  protected readonly ownReason = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly places = computed(() => (takesDecimals(this.product().saleUnit) ? 2 : 0));
  protected readonly unit = computed(() => SALE_UNIT[this.product().saleUnit].many);
  protected readonly several = computed(() => this.variants().length > 1);

  protected readonly lines = computed<Line[]>(() =>
    this.variants().map((v) => {
      const text = this.typed().get(v.id);
      const counted = text === undefined ? v.onHand : parseQuantity(text, this.product().saleUnit);
      return {
        variantId: v.id,
        name: v.name,
        reserved: v.reserved,
        onHand: v.onHand,
        counted,
        difference: counted === null ? 0 : roundQuantity(counted - v.onHand),
      };
    }),
  );
  protected readonly changes = computed(() => this.lines().filter((l) => l.counted !== null && l.difference !== 0));
  protected readonly invalid = computed(() => this.lines().some((l) => l.counted === null));
  /** The suggested reason, following what changes: «De 50 a 30 · 17 nov 2026»; nothing while nothing changes. */
  private readonly autoReason = computed(() => {
    const changes = this.changes();
    if (!changes.length) return '';
    const [only] = changes;
    if (changes.length === 1 && only) return `De ${formatNumber(only.onHand)} a ${formatNumber(only.counted!)} · ${today()}`;
    return `Actualización de ${changes.length} versiones · ${today()}`;
  });
  protected readonly shownReason = computed(() => this.ownReason() ?? this.autoReason());

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
      this.shownReason().trim() || this.autoReason(),
    );
    this.saving.set(false);
    if ('error' in result) return this.toaster.show(result.error, 'info');
    // Saved: the fields show the shelf again (the new amount), and the reason is suggested again.
    this.typed.set(new Map());
    this.ownReason.set(null);
    const line = changes[0]!;
    this.toaster.show(changes.length === 1 ? `${this.product().name}: ahora hay ${formatNumber(line.counted!)}` : 'Existencias actualizadas');
    this.saved.emit();
  }
}
