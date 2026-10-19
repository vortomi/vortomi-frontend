import type { IconName } from '../shared/ui/icon';

export type NavBadge = 'unread' | 'rejectedTemplates' | 'outOfStock';

export interface NavItem {
  path: string;
  icon: IconName;
  label: string;
  badge?: NavBadge;
  /** Shown in the phone bottom bar (four slots, as in mockup web-8). */
  mobile?: boolean;
  /** Hidden for agents; the route is also guarded. */
  adminOnly?: boolean;
  /** Hidden when the company works in support-only mode; the route is also guarded. */
  salesOnly?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const TENANT_NAV: NavGroup[] = [
  {
    title: 'Atención',
    items: [
      { path: '/inbox', icon: 'inbox', label: 'Bandeja', badge: 'unread', mobile: true },
      { path: '/contacts', icon: 'users', label: 'Contactos', mobile: true },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { path: '/pipeline', icon: 'kanban', label: 'Pipeline', mobile: true, salesOnly: true },
      { path: '/inventory', icon: 'tag', label: 'Inventario', badge: 'outOfStock', salesOnly: true },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { path: '/templates', icon: 'template', label: 'Plantillas', badge: 'rejectedTemplates' },
      { path: '/reports', icon: 'chart', label: 'Reportes', mobile: true, adminOnly: true },
    ],
  },
  {
    title: 'Empresa',
    items: [
      { path: '/channels-and-team', icon: 'phone', label: 'Canales y equipo', adminOnly: true },
      { path: '/settings', icon: 'gear', label: 'Ajustes', adminOnly: true },
    ],
  },
];

export const PLATFORM_NAV: NavItem[] = [
  { path: '/platform/tenants', icon: 'building', label: 'Empresas' },
  { path: '/platform/alerts', icon: 'alert', label: 'Alertas' },
  { path: '/platform/usage', icon: 'chart', label: 'Uso y salud' },
  { path: '/platform/subscriptions', icon: 'dollar', label: 'Suscripciones' },
];
