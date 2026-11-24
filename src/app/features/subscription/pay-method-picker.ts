import { Component, computed, inject, input, output } from '@angular/core';
import type { PaymentMethodType } from '../../shared/api/models';
import type { PayableMethod } from '../../shared/api/subscriptions';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { typeInfo } from '../payment-methods/payment-methods.models';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';

const CURRENCY_TEXT: Record<PayableMethod['currency'], string> = { USD: 'Dólares', VES: 'Bolívares' };

/**
 * Where to pay (mockups web-39 and web-40): Vortomi's methods in a dropdown and, for the one
 * chosen, its data with a button to copy each, the amount to pay in its currency, and its
 * instructions.
 */
@Component({
  selector: 'app-pay-method-picker',
  imports: [Icon, SelectMenu],
  template: `
    <p class="lbl">¿Cómo pagaste?</p>
    <app-select-menu label="Método de pago" placeholder="Elige cómo pagaste" [options]="options()" [value]="selected()?.id ?? null" (picked)="pick($event)" />
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
    .lbl { font-size: 13px; font-weight: 600; }
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
  /** Methods in this currency cannot be used now (bolívares without Vortomi's rate). */
  readonly blockedCurrency = input<PayableMethod['currency'] | null>(null);
  /** «92.435,33 Bs», «225,15 $»: what to pay with the method chosen. */
  readonly amountText = input<string | null>(null);
  /** The same amount as a number to paste in the bank's app («92435,33»). */
  readonly amountPlain = input('');
  readonly chosen = output<PayableMethod>();

  private readonly toaster = inject(Toaster);
  /** Each method with its coloured mark and its currency; one in a blocked currency cannot be chosen. */
  protected readonly options = computed<MenuOption[]>(() =>
    this.methods().map((m) => {
      const info = typeInfo(m.type as PaymentMethodType);
      const blocked = m.currency === this.blockedCurrency();
      return { value: m.id, label: m.name, icon: info.icon, color: info.color, hint: blocked ? 'Sin tasa de hoy' : CURRENCY_TEXT[m.currency], disabled: blocked };
    }),
  );

  protected pick(id: string): void {
    const method = this.methods().find((m) => m.id === id);
    if (method) this.chosen.emit(method);
  }

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(
      () => this.toaster.show('Copiado.'),
      () => this.toaster.show('No se pudo copiar.', 'info'),
    );
  }
}
