import type { Routes } from '@angular/router';
import {
  guestGuard,
  mfaPendingGuard,
  signedInGuard,
  superAdminGuard,
  salesModeGuard,
  tenantAdminGuard,
  tenantGuard,
} from './core/guards';
import { AppLayout } from './layout/app-layout';
import { AuthLayout } from './layout/auth-layout';
import { unsavedChangesGuard } from './shared/ui/unsaved-changes';

const inboxPage = () => import('./features/inbox/inbox.page').then((m) => m.InboxPage);
const profilePage = () => import('./features/account/profile.page').then((m) => m.ProfilePage);

// Paths are English like the rest of the code; Spanish lives only in the visible text.
// `mockup` points at the approved design in project-0/graphics.
export const routes: Routes = [
  // Must come first: an empty-path layout route also matches "/" when none of its children do,
  // which rendered the auth frame with an empty outlet.
  { path: '', pathMatch: 'full', redirectTo: 'inbox' },
  {
    path: '',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        title: 'Iniciar sesión',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'login/verify',
        title: 'Verificación',
        canActivate: [mfaPendingGuard],
        loadComponent: () => import('./features/auth/verify.page').then((m) => m.VerifyPage),
      },
      {
        path: 'forgot-password',
        title: 'Recuperar contraseña',
        loadComponent: () => import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage),
      },
      {
        path: 'reset-password/:token',
        title: 'Contraseña nueva',
        loadComponent: () => import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage),
      },
      {
        path: 'invitation/:token',
        title: 'Invitación',
        loadComponent: () => import('./features/auth/invitation.page').then((m) => m.InvitationPage),
      },
      {
        path: 'select-company',
        title: 'Elegir empresa',
        canActivate: [signedInGuard],
        loadComponent: () => import('./features/auth/select-company.page').then((m) => m.SelectCompanyPage),
      },
    ],
  },
  {
    path: '',
    component: AppLayout,
    canActivate: [signedInGuard, tenantGuard],
    children: [
      { path: 'inbox', title: 'Bandeja', loadComponent: inboxPage },
      { path: 'inbox/:conversationId', title: 'Bandeja', loadComponent: inboxPage },
      {
        path: 'pipeline',
        canActivate: [salesModeGuard],
        title: 'Pipeline',
        loadComponent: () => import('./features/pipeline/pipeline.page').then((m) => m.PipelinePage),
      },
      {
        path: 'inventory',
        canActivate: [salesModeGuard],
        title: 'Inventario',
        loadComponent: () => import('./features/inventory/inventory.page').then((m) => m.InventoryPage),
      },
      {
        // Before inventory/:productId, which would otherwise take "categories" as a product id.
        path: 'inventory/categories',
        title: 'Categorías',
        canActivate: [tenantAdminGuard, salesModeGuard],
        loadComponent: () => import('./features/inventory/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'inventory/new',
        title: 'Nuevo producto',
        canActivate: [tenantAdminGuard],
        loadComponent: () => import('./features/inventory/product-detail.page').then((m) => m.ProductDetailPage),
      },
      {
        path: 'inventory/:productId',
        canActivate: [salesModeGuard],
        title: 'Producto',
        loadComponent: () => import('./features/inventory/product-detail.page').then((m) => m.ProductDetailPage),
      },
      {
        path: 'contacts',
        title: 'Contactos',
        loadComponent: () => import('./features/contacts/contacts.page').then((m) => m.ContactsPage),
      },
      {
        path: 'contacts/new',
        title: 'Nuevo contacto',
        loadComponent: () => import('./features/contacts/contact-detail.page').then((m) => m.ContactDetailPage),
      },
      {
        path: 'contacts/:contactId',
        title: 'Contacto',
        loadComponent: () => import('./features/contacts/contact-detail.page').then((m) => m.ContactDetailPage),
      },
      {
        path: 'templates',
        title: 'Plantillas',
        loadComponent: () => import('./features/templates/templates.page').then((m) => m.TemplatesPage),
      },
      {
        path: 'templates/new',
        title: 'Nueva plantilla',
        canActivate: [tenantAdminGuard],
        loadComponent: () => import('./features/templates/template-editor.page').then((m) => m.TemplateEditorPage),
      },
      {
        path: 'reports',
        title: 'Reportes',
        canActivate: [tenantAdminGuard],
        loadComponent: () => import('./features/reports/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'channels-and-team',
        title: 'Canales y equipo',
        canActivate: [tenantAdminGuard],
        loadComponent: () => import('./features/team/channels-team.page').then((m) => m.ChannelsTeamPage),
      },
      {
        path: 'settings',
        title: 'Ajustes',
        canActivate: [tenantAdminGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
      },
      { path: 'profile', title: 'Mi perfil', loadComponent: profilePage },
    ],
  },
  {
    // Platform console. Lazy, so its code is only downloaded when someone opens it.
    path: 'platform',
    canActivate: [signedInGuard, superAdminGuard],
    loadComponent: () => import('./layout/platform-layout').then((m) => m.PlatformLayout),
    loadChildren: () => import('./features/platform/platform.routes').then((m) => m.PLATFORM_ROUTES),
  },
  { path: '**', redirectTo: 'inbox' },
];
