import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { PaymentMethodList } from './payment-method-list';
import { PAYMENT_METHODS_HOST } from './payment-methods.host';

/**
 * «Métodos de pago» of the panel: what customers see to pay their order, in the order the agent
 * offers them. The cards are PaymentMethodList, on the company's host (route providers). Admins only.
 */
@Component({
  selector: 'app-payment-methods-page',
  imports: [Icon, PaymentMethodList, RouterLink],
  template: `
    <header class="page-top">
      <div>
        <h1>Métodos de pago</h1>
        <span class="sub">{{ host.texts.listIntro }}</span>
      </div>
      <span class="spacer"></span>
      <a class="btn btn--primary" [routerLink]="[host.formBase, 'new']"><app-icon name="plus" /><span>Agregar método</span></a>
    </header>
    <div class="page-body"><app-payment-method-list /></div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  `,
})
export class PaymentMethodsPage {
  protected readonly host = inject(PAYMENT_METHODS_HOST);
}
