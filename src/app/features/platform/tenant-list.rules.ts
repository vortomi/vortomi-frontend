import type { Tenant, TenantStatus } from '../../shared/api/models';
import type { TenantRow } from './platform.data';
import type { TenantListInsight } from './tenant-insights.remote';

/** The tabs of the list (mockup web-25): sign-ups in progress are grouped. */
export type StatusTab = 'all' | 'active' | 'onboarding' | 'awaiting_owner' | 'suspended' | 'cancelled';
export type SortKey = 'activity' | 'name' | 'messages' | 'created';

export const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'active', label: 'Activas' },
  { key: 'onboarding', label: 'En alta' },
  { key: 'awaiting_owner', label: 'Esperando al dueño' },
  { key: 'suspended', label: 'Suspendidas' },
  { key: 'cancelled', label: 'De baja' },
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'activity', label: 'Más actividad reciente' },
  { value: 'messages', label: 'Más mensajes' },
  { value: 'name', label: 'Nombre' },
  { value: 'created', label: 'Más nuevas' },
];

const TAB_OF: Record<TenantStatus, StatusTab> = {
  active: 'active',
  draft: 'onboarding',
  awaiting_channel: 'onboarding',
  awaiting_owner: 'awaiting_owner',
  suspended: 'suspended',
  cancelled: 'cancelled',
};

export const tabOf = (status: TenantStatus): StatusTab => TAB_OF[status];

export const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Name, city, business type, legal name, RIF or one of its numbers (digits are enough). */
export function matchesSearch(row: TenantRow, typeLabel: string, needle: string): boolean {
  const query = normalize(needle.trim());
  if (!query) return true;
  const { tenant } = row;
  if (normalize(`${tenant.name} ${tenant.city} ${typeLabel} ${tenant.legalName} ${tenant.taxId}`).includes(query)) return true;
  const digits = query.replace(/\D/g, '');
  return digits.length >= 4 && row.channels.some((c) => c.displayNumber.replace(/\D/g, '').includes(digits));
}

export const sumOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

export function sortRows(rows: TenantRow[], key: SortKey, insights: Map<string, TenantListInsight>): TenantRow[] {
  const byName = (a: TenantRow, b: TenantRow) => a.tenant.name.localeCompare(b.tenant.name, 'es');
  const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : 0);
  const compare: Record<SortKey, (a: TenantRow, b: TenantRow) => number> = {
    name: byName,
    created: (a, b) => time(b.tenant.createdAt) - time(a.tenant.createdAt) || byName(a, b),
    messages: (a, b) => sumOf(insights.get(b.tenant.id)?.daily ?? []) - sumOf(insights.get(a.tenant.id)?.daily ?? []) || byName(a, b),
    activity: (a, b) => time(insights.get(b.tenant.id)?.lastActivityAt) - time(insights.get(a.tenant.id)?.lastActivityAt) || byName(a, b),
  };
  return [...rows].sort(compare[key]);
}

export type Tone = 'green' | 'amber' | 'red' | 'neutral';

/** How a company's numbers are, in a few words: «ambos bien», «1 desconectado»... */
export function numbersSummary(row: TenantRow, now: Date): { text: string; tone: Tone } | null {
  const { channels } = row;
  if (!channels.length) return null;
  const disconnected = channels.filter((c) => c.status === 'disconnected').length;
  if (disconnected) return { text: disconnected === 1 ? 'Desconectado' : `${disconnected} desconectados`, tone: 'red' };
  if (channels.some((c) => c.status === 'restricted')) return { text: 'Restringido', tone: 'amber' };
  const expiring = channels
    .map((c) => (c.accessExpiresAt ? Math.ceil((Date.parse(c.accessExpiresAt) - now.getTime()) / 86_400_000) : null))
    .filter((days): days is number => days !== null && days <= 7);
  if (expiring.length) {
    const days = Math.min(...expiring);
    return days <= 0 ? { text: 'Acceso vencido', tone: 'red' } : { text: `Acceso vence en ${days} ${days === 1 ? 'día' : 'días'}`, tone: 'amber' };
  }
  return { text: channels.length === 1 ? 'bien' : channels.length === 2 ? 'ambos bien' : 'todos bien', tone: 'green' };
}

/** «ahora», «hace 4 min», «hace 2 h», «hace 5 días». */
export function timeAgo(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

/** No activity for this long, on a company that should be working, reads as a warning. */
export const QUIET_DAYS = 3;
export const isQuiet = (tenant: Tenant, lastActivityAt: string | null, now: Date) =>
  tenant.status === 'active' && (!lastActivityAt || now.getTime() - Date.parse(lastActivityAt) > QUIET_DAYS * 86_400_000);

/** +12 for 12 % more than before; null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}
