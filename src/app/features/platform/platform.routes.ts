import type { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../shared/ui/unsaved-changes';
import { PAYMENT_METHODS_HOST } from '../payment-methods/payment-methods.host';
import { PlatformPaymentMethodsHost } from './subscriptions/platform-payment-methods.host';

export const PLATFORM_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tenants' },
  {
    path: 'tenants',
    title: 'Empresas · Consola',
    loadComponent: () => import('./tenants.page').then((m) => m.TenantsPage),
  },
  {
    path: 'tenants/new',
    title: 'Nueva empresa · Consola',
    loadComponent: () => import('./onboarding/onboarding.page').then((m) => m.OnboardingPage),
  },
  {
    path: 'tenants/:tenantId',
    title: 'Empresa · Consola',
    loadComponent: () => import('./tenant-detail.page').then((m) => m.TenantDetailPage),
  },
  {
    path: 'alerts',
    title: 'Alertas · Consola',
    loadComponent: () => import('./alerts.page').then((m) => m.AlertsPage),
  },
  {
    path: 'usage',
    title: 'Uso y salud · Consola',
    loadComponent: () => import('./usage.page').then((m) => m.UsagePage),
  },
  {
    // One company's use and health (mockup web-27), from «Por empresa».
    path: 'usage/:tenantId',
    title: 'Uso de una empresa · Consola',
    loadComponent: () => import('./usage-company.page').then((m) => m.UsageCompanyPage),
  },
  {
    path: 'team',
    title: 'Staff · Consola',
    loadComponent: () => import('./platform-team.page').then((m) => m.PlatformTeamPage),
  },
  {
    // Charges and plans are sample data until the billing model is decided (mockup web-32, option A);
    // Vortomi's payment methods are real, on the same screens as a company's own (shared host).
    path: 'subscriptions',
    providers: [{ provide: PAYMENT_METHODS_HOST, useClass: PlatformPaymentMethodsHost }],
    children: [
      {
        path: '',
        title: 'Suscripciones · Consola',
        loadComponent: () => import('./subscriptions/subscriptions.page').then((m) => m.SubscriptionsPage),
      },
      {
        // "new" before :methodId, which would otherwise take it as an id.
        path: 'payment-methods/new',
        canDeactivate: [unsavedChangesGuard],
        title: 'Nuevo método de pago · Consola',
        loadComponent: () => import('../payment-methods/payment-method-form.page').then((m) => m.PaymentMethodFormPage),
      },
      {
        path: 'payment-methods/:methodId',
        canDeactivate: [unsavedChangesGuard],
        title: 'Método de pago · Consola',
        loadComponent: () => import('../payment-methods/payment-method-form.page').then((m) => m.PaymentMethodFormPage),
      },
      {
        // Vortomi's plans (mockup web-34). "new" before :planId.
        path: 'plans/new',
        canDeactivate: [unsavedChangesGuard],
        title: 'Nuevo plan · Consola',
        loadComponent: () => import('./plans/plan-form.page').then((m) => m.PlanFormPage),
      },
      {
        path: 'plans/:planId',
        canDeactivate: [unsavedChangesGuard],
        title: 'Plan · Consola',
        loadComponent: () => import('./plans/plan-form.page').then((m) => m.PlanFormPage),
      },
    ],
  },
  {
    path: 'settings',
    title: 'Ajustes · Consola',
    loadComponent: () => import('./settings/platform-settings.page').then((m) => m.PlatformSettingsPage),
  },
  {
    path: 'profile',
    title: 'Mi perfil · Consola',
    loadComponent: () => import('../account/profile.page').then((m) => m.ProfilePage),
  },
];
