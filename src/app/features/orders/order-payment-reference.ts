import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { OrderDetail } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { OrdersRemote } from './orders-remote';

/**
 * «Referencia del pago»: whoever checks the payment writes down the bank's reference, and it goes
 * on the sale receipt. Saved on its own, without touching the order's status.
 */
@Component({
  selector: 'app-order-payment-reference',
  imports: [Icon],
  template: `
    <div class="field">
      <label for="payment-reference">Referencia del pago</label>
      <div class="row">
        <input id="payment-reference" class="input" maxlength="40" inputmode="numeric" autocomplete="off" placeholder="Ej. 000123456"
          [value]="text()" (input)="text.set(value($event))" (keydown.enter)="save()" />
        <button type="button" class="btn" [disabled]="saving() || !changed()" (click)="save()"><app-icon name="check" />Guardar</button>
      </div>
      <p class="field-hint">La que aparece en el comprobante del cliente. Sale en su recibo.</p>
    </div>
  `,
  styles: `
    .row { display: flex; gap: 8px; }
    .row .input { max-width: 240px; }
  `,
})
export class OrderPaymentReference {
  private readonly remote = inject(OrdersRemote);
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);

  readonly order = input.required<OrderDetail>();
  readonly saved = output<void>();

  protected readonly text = signal('');
  protected readonly saving = signal(false);
  protected readonly changed = computed(() => this.text().trim() !== (this.order().paymentReference ?? ''));

  constructor() {
    // What the server has, whenever the order reloads and nothing is being typed over it.
    effect(() => this.text.set(this.order().paymentReference ?? ''));
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async save(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!tenantId || this.saving() || !this.changed()) return;
    this.saving.set(true);
    try {
      await this.remote.setPaymentReference(tenantId, this.order().id, this.text().trim());
      this.toaster.show('Referencia guardada');
      this.saved.emit();
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.saving.set(false);
    }
  }
}
