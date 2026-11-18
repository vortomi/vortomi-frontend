import type { ApiMyProfile } from '../../shared/api/contract';
import type { IconName } from '../../shared/ui/icon';

type Activity = ApiMyProfile['activity'][number];

/** One's own actions, in second person («Suspendiste…»): the profile speaks to its owner. */
const YOU: Record<Activity['action'], { text: string; icon: IconName; tone: string }> = {
  'tenant.created': { text: 'Diste de alta a', icon: 'plus', tone: 'green' },
  'tenant.updated': { text: 'Editaste los datos de', icon: 'edit', tone: 'blue' },
  'tenant.draft_discarded': { text: 'Descartaste el borrador de', icon: 'trash', tone: 'gray' },
  'tenant.activated': { text: 'Activaste', icon: 'check', tone: 'green' },
  'tenant.suspended': { text: 'Suspendiste', icon: 'alert', tone: 'amber' },
  'tenant.cancelled': { text: 'Diste de baja a', icon: 'x', tone: 'red' },
  'channel.connected': { text: 'Conectaste un número de', icon: 'phone', tone: 'green' },
  'channel.replaced': { text: 'Cambiaste un número o su clave en', icon: 'swap', tone: 'blue' },
  'channel.refreshed': { text: 'Actualizaste desde Meta un número de', icon: 'swap', tone: 'gray' },
  'tenant.admin_invited': { text: 'Invitaste a un administrador de', icon: 'mail', tone: 'blue' },
  'tenant.owner_invited': { text: 'Invitaste al dueño de', icon: 'mail', tone: 'blue' },
  'tenant.invitation_renewed': { text: 'Renovaste una invitación de', icon: 'mail', tone: 'gray' },
  'tenant.invitation_revoked': { text: 'Anulaste una invitación de', icon: 'x', tone: 'gray' },
  'business_type.created': { text: 'Creaste un rubro nuevo', icon: 'tag', tone: 'blue' },
  'business_type.reclassified': { text: 'Reclasificaste empresas a otro rubro', icon: 'tag', tone: 'gray' },
  'tenant.password_reset': { text: 'Diste un enlace para restablecer una contraseña en', icon: 'lock', tone: 'amber' },
  'tenant.owner_changed': { text: 'Cambiaste el dueño de', icon: 'swap', tone: 'blue' },
  'admin.invited': { text: 'Invitaste al staff a', icon: 'mail', tone: 'blue' },
  'admin.invitation_renewed': { text: 'Creaste un enlace nuevo para', icon: 'mail', tone: 'gray' },
  'admin.invitation_revoked': { text: 'Anulaste la invitación de', icon: 'x', tone: 'gray' },
  'admin.joined': { text: 'Entraste al staff', icon: 'check', tone: 'green' },
  'admin.code_reset': { text: 'Reiniciaste el código de seguridad de', icon: 'swap', tone: 'amber' },
  'admin.removed': { text: 'Quitaste el acceso a', icon: 'x', tone: 'red' },
  'admin.session_ended': { text: 'Cerraste una sesión de', icon: 'lock', tone: 'gray' },
  'admin.sessions_ended': { text: 'Cerraste todas las sesiones de', icon: 'lock', tone: 'gray' },
  'admin.password_reset': { text: 'Diste un enlace para restablecer la contraseña a', icon: 'lock', tone: 'amber' },
};

export function myActivityLook(entry: Activity): { text: string; icon: IconName; tone: string; target: string | null } {
  const look = YOU[entry.action];
  // Joining names nobody; anything else names the company or the person it was about.
  return { ...look, target: entry.action === 'admin.joined' ? null : entry.target };
}

const ROLE: Record<'admin' | 'agent', string> = { admin: 'Administración', agent: 'Agente' };
export const roleText = (role: 'admin' | 'agent') => ROLE[role];

/** «Super admin · Staff» or «Agente en Repuestos Andinos». */
export function roleBadge(profile: Pick<ApiMyProfile, 'staff' | 'companies'>, tenantId: string | null): string {
  if (profile.staff) return 'Super admin · Staff';
  const here = profile.companies.find((c) => c.tenantId === tenantId) ?? profile.companies[0];
  return here ? `${ROLE[here.role]} en ${here.name}` : 'Sin empresa';
}

/** «En Chrome en macOS (esta) y en Edge en Windows». */
export function sessionsLine(sessions: ApiMyProfile['sessions']): string {
  if (!sessions.length) return 'Ninguna, aparte de esta';
  const names = sessions.map((s) => `${s.browser} en ${s.system}${s.current ? ' (esta)' : ''}`);
  return `En ${names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0]}`;
}
