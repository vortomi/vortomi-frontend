import type { Routes } from '@angular/router';

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
    // Sample data until the billing model is decided (mockup web-32, option A).
    path: 'subscriptions',
    title: 'Suscripciones · Consola',
    loadComponent: () => import('./subscriptions/subscriptions.page').then((m) => m.SubscriptionsPage),
  },
  {
    path: 'subscriptions/:subscriptionId',
    title: 'Suscripción · Consola',
    loadComponent: () => import('./subscriptions/subscription-detail.page').then((m) => m.SubscriptionDetailPage),
  },
  {
    path: 'profile',
    title: 'Mi perfil · Consola',
    loadComponent: () => import('../account/profile.page').then((m) => m.ProfilePage),
  },
];
