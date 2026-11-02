import { Component, computed, input } from '@angular/core';
import type { PaymentMethodType } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { typeInfo } from './payment-methods.models';

/** The coloured mark of a payment method type, the same in the list, the selector and the orders. */
@Component({
  selector: 'app-method-badge',
  imports: [Icon],
  template: `<app-icon [name]="info().icon" />`,
  host: { '[style.background]': 'info().color', '[attr.aria-hidden]': 'true' },
  styles: `
    :host { width: var(--badge-size, 36px); height: var(--badge-size, 36px); border-radius: 10px; flex-shrink: 0; display: inline-flex;
      align-items: center; justify-content: center; color: #fff; --icon-size: calc(var(--badge-size, 36px) * 0.5); }
  `,
})
export class MethodBadge {
  readonly type = input.required<PaymentMethodType>();
  protected readonly info = computed(() => typeInfo(this.type()));
}
