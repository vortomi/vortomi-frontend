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
    path: 'subscriptions',
    loadComponent: () => import('../../shared/ui/coming-soon').then((m) => m.ComingSoon),
    data: { title: 'Suscripciones', mockup: 'web-7-plataforma' },
  },
  {
    path: 'profile',
    title: 'Mi perfil · Consola',
    loadComponent: () => import('../account/profile.page').then((m) => m.ProfilePage),
  },
];
