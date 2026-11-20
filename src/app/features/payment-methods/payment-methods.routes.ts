import type { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../shared/ui/unsaved-changes';
import { CompanyPaymentMethodsHost, PAYMENT_METHODS_HOST } from './payment-methods.host';

/** The panel's «Métodos de pago» (loaded on first visit): list and editor on the company's host. */
export const PAYMENT_METHOD_ROUTES: Routes = [
  {
    path: '',
    providers: [{ provide: PAYMENT_METHODS_HOST, useClass: CompanyPaymentMethodsHost }],
    children: [
      {
        path: '',
        title: 'Métodos de pago',
        loadComponent: () => import('./payment-methods.page').then((m) => m.PaymentMethodsPage),
      },
      {
        // "new" before :methodId, which would otherwise take it as an id.
        path: 'new',
        canDeactivate: [unsavedChangesGuard],
        title: 'Nuevo método de pago',
        loadComponent: () => import('./payment-method-form.page').then((m) => m.PaymentMethodFormPage),
      },
      {
        path: ':methodId',
        canDeactivate: [unsavedChangesGuard],
        title: 'Método de pago',
        loadComponent: () => import('./payment-method-form.page').then((m) => m.PaymentMethodFormPage),
      },
    ],
  },
];
