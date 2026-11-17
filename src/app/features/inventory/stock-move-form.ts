import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ApiFailure } from '../../core/api/api-error';
import type { Product, ProductVariant, StockMovementKind } from '../../shared/api/models';
import { Confirm } from '../../shared/ui/confirm';
import { NumericInput } from '../../shared/ui/numeric-input';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import { Toaster } from '../../shared/ui/toaster';
import { InventoryData } from './inventory.data';
import { MOVEMENT_LABEL, signedMovement } from './inventory.rules';
import { SALE_UNIT, formatNumber, takesDecimals } from './sale-units';

/** Kinds a person records by hand; "sale" also comes from paid orders. */
const MANUAL_KINDS: StockMovementKind[] = ['purchase', 'sale', 'loss', 'return', 'adjustment'];
const KIND_OPTIONS: MenuOption[] = MANUAL_KINDS.map((k) => ({ value: k, label: MOVEMENT_LABEL[k] }));

/**
 * One stock movement of a product (Entrada, Venta, Merma, Devolución, Ajuste): the product page's
 * «Existencias» box and the inventory list's quick box (mockup web-23). Asks before recording, since
 * a movement is history and is never edited; the button says how much will be left.
 */
@Component({
  selector: 'app-stock-move-form',
  imports: [NumericInput, SelectMenu],
  template: `
    @let p = product();
    <div class="move">
      @if (variants().length > 1) {
        <app-select-menu label="Variante" [options]="variantOptions()" [value]="variantId() || null" (picked)="variantId.set($event)" />
      }
      <app-select-menu label="Tipo de movimiento" [options]="kindOptions" [value]="kind()" (picked)="setKind($event)" />
      <input class="input" appNumeric="quantity" [decimals]="places()" [allowNegative]="kind() === 'adjustment'" inputmode="decimal"
        [attr.aria-label]="'Cantidad en ' + unitText[p.saleUnit].many" [value]="quantity()" (input)="quantity.set(value($event))" />
      <input class="input reason" aria-label="Motivo" placeholder="Motivo (ej.: factura 0012)" [value]="reason()" (input)="reason.set(value($event))" />
      <button type="button" class="btn btn--primary record" [disabled]="recording()" [attr.aria-busy]="recording()" (click)="record()">
        <span>Registrar{{ after() === null ? '' : ' → ' + number(after()!) }}</span>
      </button>
      <p class="field-hint">Cantidad en {{ unitText[p.saleUnit].many }}. Venta y merma restan; en Ajuste usa negativo para restar. Todo queda en el historial.</p>
    </div>
  `,
  styles: `
    .move { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .reason, .record, .field-hint { grid-column: 1 / -1; }
  `,
})
export class StockMoveForm {
  readonly product = input.required<Product>();
  readonly variants = input.required<ProductVariant[]>();
  /** Recorded: the list closes its box. */
  readonly recorded = output<void>();

  private readonly data = inject(InventoryData);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly unitText = SALE_UNIT;
  protected readonly number = formatNumber;
  protected readonly variantId = signal('');
  protected readonly kind = signal<StockMovementKind>('purchase');
  protected readonly quantity = signal('1');
  protected readonly reason = signal('');
  protected readonly recording = signal(false);

  protected readonly variantOptions = computed<MenuOption[]>(() => this.variants().map((v) => ({ value: v.id, label: v.name })));
  protected readonly places = computed(() => (takesDecimals(this.product().saleUnit) ? 2 : 0));
  private readonly variant = computed(() => this.variants().find((v) => v.id === this.variantId()) ?? null);
  private readonly signed = computed(() => signedMovement(this.kind(), this.quantity(), this.product().saleUnit));
  /** What will be on the shelf once recorded; null while the amount is not valid. */
  protected readonly after = computed(() => {
    const variant = this.variant();
    const signed = this.signed();
    return variant && signed !== null ? variant.onHand + signed : null;
  });

  constructor() {
    // The first version is chosen until the person picks another (and again if it disappears).
    effect(() => {
      const versions = this.variants();
      if (!versions.some((v) => v.id === untracked(this.variantId))) this.variantId.set(versions[0]?.id ?? '');
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected setKind(value: string): void {
    this.kind.set(value as StockMovementKind);
  }

  protected async record(): Promise<void> {
    const variant = this.variant();
    const signed = this.signed();
    if (!variant) return;
    if (signed === null) {
      const decimals = takesDecimals(this.product().saleUnit);
      return this.toaster.show(decimals ? 'Escribe una cantidad mayor que cero, con hasta 2 decimales.' : 'Escribe una cantidad entera mayor que cero.', 'info');
    }
    if (this.recording()) return;
    this.recording.set(true);
    const kind = this.kind();
    const done = await this.confirm.ask({
      title: 'Registrar el movimiento',
      message: `${MOVEMENT_LABEL[kind]} de ${formatNumber(signed)} en «${this.product().name} · ${variant.name}». Queda en el historial y no se puede borrar ni editar.`,
      confirmLabel: 'Registrar',
      action: async () => {
        const error = await this.data.recordMovement(variant.id, kind, signed, this.reason());
        if (error) throw new ApiFailure(0, 'movement_refused', error);
      },
    });
    this.recording.set(false);
    if (!done) return;
    this.quantity.set('1');
    this.reason.set('');
    this.toaster.show('Movimiento registrado');
    this.recorded.emit();
  }
}
