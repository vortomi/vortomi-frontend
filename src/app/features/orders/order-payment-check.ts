import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { OrderDetail } from '../../shared/api/models';
import { formatAmount, parseAmount } from '../../shared/format/money';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { normalizeReference, validReference } from './orders.models';
import { OrdersRemote } from './orders-remote';

/**
 * «Revisión del pago»: whoever checks the payment writes down the bank's reference (it goes on the
 * sale receipt) and how much arrived, next to what should arrive. Saved on its own, without moving
 * the order; confirming asks for the reference when the payment method needs it.
 */
@Component({
  selector: 'app-order-payment-check',
  imports: [Icon],
  template: `
    <div class="fields">
      <div class="field">
        <label for="payment-reference">Referencia del pago</label>
        <input id="payment-reference" class="input" maxlength="60" autocomplete="off" placeholder="Ej. 000123456"
          [value]="reference()" (input)="reference.set(value($event))" (keydown.enter)="save()" />
        <p class="field-hint" [class.bad]="referenceBad()">{{ referenceBad() ? 'Al menos 4 letras o números.' : 'La del comprobante del cliente. Sale en su recibo.' }}</p>
      </div>
      <div class="field">
        <label for="received-amount">Monto recibido ({{ currencyLabel() }})</label>
        <input id="received-amount" class="input" inputmode="decimal" autocomplete="off" [placeholder]="expectedText() ?? 'Ej. 1.250,00'"
          [value]="amount()" (input)="amount.set(value($event))" (keydown.enter)="save()" />
        <p class="field-hint" [class.bad]="amountBad() || short()">
          @if (amountBad()) { Escribe solo el número, por ejemplo 1.250,50. }
          @else if (short()) { Llegó menos de lo que cuesta el pedido. }
          @else if (expectedText(); as expected) { Debe llegar {{ expected }}. }
          @else { Lo que viste llegar a la cuenta. }
        </p>
      </div>
    </div>
    <button type="button" class="btn" [disabled]="saving() || !changed() || referenceBad() || amountBad()" [attr.aria-busy]="saving()" (click)="save()"><app-icon name="check" /><span>Guardar</span></button>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .field-hint.bad { color: var(--color-warning-text); }
    .btn { align-self: flex-start; }
  `,
})
export class OrderPaymentCheck {
  private readonly remote = inject(OrdersRemote);
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);

  readonly order = input.required<OrderDetail>();
  readonly saved = output<void>();

  protected readonly reference = signal('');
  protected readonly amount = signal('');
  protected readonly saving = signal(false);

  private readonly currency = computed(() => this.order().paymentMethod?.currency ?? 'USD');
  protected readonly currencyLabel = computed(() => ({ VES: 'Bs', USD: '$', EUR: '€' })[this.currency()]);
  protected readonly expectedText = computed(() => {
    const expected = this.order().expectedAmount;
    return expected === null ? null : formatAmount(Number(expected), this.currency());
  });
  private readonly typedReference = computed(() => normalizeReference(this.reference()));
  /** What the server will store, or null when the text is not an amount. */
  private readonly typedAmount = computed(() => (this.amount().trim() ? parseAmount(this.amount()) : ''));
  protected readonly referenceBad = computed(() => this.typedReference() !== '' && !validReference(this.typedReference()));
  protected readonly amountBad = computed(() => this.typedAmount() === null);
  /** The same rule as the server's alert: clearly below what should arrive (not the rounding of the rate). */
  protected readonly short = computed(() => {
    const expected = this.order().expectedAmount;
    const typed = this.typedAmount();
    return !!expected && !!typed && Number(expected) - Number(typed) > Number(expected) * 0.005;
  });
  protected readonly changed = computed(
    () => this.typedReference() !== (this.order().paymentReference ?? '') || (this.typedAmount() ?? '') !== (this.order().receivedAmount ?? ''),
  );

  constructor() {
    // What the server has, whenever the order reloads.
    effect(() => {
      const o = this.order();
      this.reference.set(o.paymentReference ?? '');
      this.amount.set(o.receivedAmount ? formatAmount(Number(o.receivedAmount), this.currency()).replace(/\s?(Bs|\$|€)$/, '') : '');
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async save(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    const receivedAmount = this.typedAmount();
    if (!tenantId || this.saving() || !this.changed() || this.referenceBad() || receivedAmount === null) return;
    this.saving.set(true);
    try {
      await this.remote.setPayment(tenantId, this.order().id, { reference: this.typedReference(), receivedAmount });
      this.toaster.show('Pago anotado');
      this.saved.emit();
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.saving.set(false);
    }
  }
}
