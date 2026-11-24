import { Component, inject, input, output } from '@angular/core';
import type { PaymentMethodType } from '../../shared/api/models';
import type { PayableMethod } from '../../shared/api/subscriptions';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { MethodBadge } from '../payment-methods/method-badge';

const CURRENCY_TEXT: Record<PayableMethod['currency'], string> = { USD: 'Dólares', VES: 'Bolívares' };

/**
 * Where to pay (mockups web-39 and web-40): Vortomi's methods to choose from and, for the one
 * chosen, its data with a button to copy each, the amount to pay in its currency, and its
 * instructions.
 */
@Component({
  selector: 'app-pay-method-picker',
  imports: [Icon, MethodBadge],
  template: `
    <div class="methods" role="radiogroup" aria-label="Método de pago">
      @for (method of methods(); track method.id) {
        <button type="button" role="radio" class="method" [class.on]="method.id === selected()?.id" [attr.aria-checked]="method.id === selected()?.id"
          (click)="chosen.emit(method)">
          <app-method-badge [type]="asType(method.type)" />
          <b>{{ method.name }}</b>
          <span class="cur">{{ currency[method.currency] }}</span>
        </button>
      }
    </div>
    @if (selected(); as method) {
      <div class="data">
        @for (field of method.fields; track $index) {
          <div class="row"><span>{{ field.label }}</span><b>{{ field.value }}</b>
            <button type="button" class="copy" [attr.aria-label]="'Copiar ' + field.label" (click)="copy(field.value)"><app-icon name="copy" /></button></div>
        }
        @if (amountText(); as amount) {
          <div class="row due"><span>A pagar</span><b>{{ amount }}</b>
            <button type="button" class="copy" aria-label="Copiar el monto" (click)="copy(amountPlain())"><app-icon name="copy" /></button></div>
        }
        @if (method.instructions) { <p class="ins">{{ method.instructions }}</p> }
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 8px; }
    .methods { display: flex; flex-direction: column; gap: 6px; }
    .method { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 14px; cursor: pointer; text-align: left; --badge-size: 28px; }
    .method:hover { border-color: var(--color-border-strong); }
    .method.on { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); background: var(--color-primary-softer); }
    .cur { margin-left: auto; font-size: 12px; color: var(--color-text-muted); }
    .data { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-muted); }
    .row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .row span { color: var(--color-text-muted); min-width: 90px; }
    .row b { flex: 1; min-width: 0; text-align: right; font-weight: 600; overflow-wrap: anywhere; }
    .row.due b { font-size: 15px; }
    .copy { flex: none; width: 28px; height: 28px; border: 0; background: none; border-radius: var(--radius-sm); color: var(--color-primary-text); cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center; --icon-size: 15px; }
    .copy:hover { background: var(--color-primary-softer); }
    .ins { font-size: 12.5px; color: var(--color-text-2); line-height: 1.45; border-top: 1px solid var(--color-border); padding-top: 8px; }
  `,
})
export class PayMethodPicker {
  readonly methods = input.required<PayableMethod[]>();
  readonly selected = input<PayableMethod | null>(null);
  /** «92.435,33 Bs», «225,15 $»: what to pay with the method chosen. */
  readonly amountText = input<string | null>(null);
  /** The same amount as a number to paste in the bank's app («92435,33»). */
  readonly amountPlain = input('');
  readonly chosen = output<PayableMethod>();

  private readonly toaster = inject(Toaster);
  protected readonly currency = CURRENCY_TEXT;
  protected readonly asType = (type: string) => type as PaymentMethodType;

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(
      () => this.toaster.show('Copiado.'),
      () => this.toaster.show('No se pudo copiar.', 'info'),
    );
  }
}
