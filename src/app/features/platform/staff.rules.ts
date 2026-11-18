import type { ApiPlatformTeam, ConsoleAction, PlatformTeamAction } from '../../shared/api/contract';
import type { IconName } from '../../shared/ui/icon';

export type StaffMember = ApiPlatformTeam['admins'][number];
export type TeamEvent = ApiPlatformTeam['events'][number];
export type ActivityEntry = ApiPlatformTeam['activity'][number];

const DAY_MS = 86_400_000;

/** The four figures at the top of «Staff» (mockup web-28). */
export interface StaffSummary {
  withAccess: number;
  pendingInvitations: number;
  withCode: number;
  /** Who still sets their code up when they come in. */
  withoutCode: string[];
  sessions: number;
  devices: number;
  lastAccess: { name: string; at: string; device: string | null } | null;
}

export function staffSummary(team: ApiPlatformTeam): StaffSummary {
  const latest = [...team.sessions].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))[0] ?? null;
  return {
    withAccess: team.admins.length,
    pendingInvitations: team.invitations.length,
    withCode: team.admins.filter((a) => a.hasCode).length,
    withoutCode: team.admins.filter((a) => !a.hasCode).map((a) => a.name),
    sessions: team.sessions.length,
    devices: new Set(team.sessions.map((s) => `${s.userId}|${s.browser}|${s.system}`)).size,
    lastAccess: latest ? { name: latest.name, at: latest.lastActiveAt, device: `${latest.browser} en ${latest.system}` } : null,
  };
}

/** The yellow strip: what weakens the console's safety right now. Empty when all is fine. */
export function staffWarnings(team: ApiPlatformTeam, now: Date): string[] {
  const warnings = team.admins.filter((a) => !a.hasCode).map((a) => `${a.name} todavía no activó su código de seguridad`);
  for (const invitation of team.invitations) {
    const left = Date.parse(invitation.expiresAt) - now.getTime();
    if (left <= 0) warnings.push(`la invitación de ${invitation.name} venció`);
    else if (left <= DAY_MS) warnings.push(`la invitación de ${invitation.name} vence pronto`);
  }
  return warnings;
}

/** «Vence mañana», «Vence en 3 días», «Venció». */
export function expiryText(iso: string, now: Date): { text: string; tone: 'amber' | 'red' | 'blue' } {
  const left = Date.parse(iso) - now.getTime();
  if (left <= 0) return { text: 'Venció', tone: 'red' };
  if (left <= DAY_MS) return { text: 'Vence en menos de un día', tone: 'amber' };
  const days = Math.ceil(left / DAY_MS);
  return { text: days === 1 ? 'Vence mañana' : `Vence en ${days} días`, tone: days <= 1 ? 'amber' : 'blue' };
}

export type HistoryKind = 'all' | 'invitations' | 'access' | 'codes' | 'sessions';

const TEAM_EVENT: Record<PlatformTeamAction, { text: string; kind: Exclude<HistoryKind, 'all'>; icon: IconName; tone: string }> = {
  'admin.invited': { text: 'invitó a', kind: 'invitations', icon: 'mail', tone: 'blue' },
  'admin.invitation_renewed': { text: 'creó un enlace nuevo para', kind: 'invitations', icon: 'mail', tone: 'blue' },
  'admin.invitation_revoked': { text: 'anuló la invitación de', kind: 'invitations', icon: 'x', tone: 'gray' },
  'admin.joined': { text: 'aceptó la invitación y entró al staff', kind: 'access', icon: 'check', tone: 'green' },
  'admin.code_reset': { text: 'reinició el código de seguridad de', kind: 'codes', icon: 'swap', tone: 'amber' },
  'admin.removed': { text: 'quitó el acceso a', kind: 'access', icon: 'x', tone: 'red' },
  'admin.session_ended': { text: 'cerró una sesión de', kind: 'sessions', icon: 'lock', tone: 'gray' },
  'admin.sessions_ended': { text: 'cerró todas las sesiones de', kind: 'sessions', icon: 'lock', tone: 'gray' },
  'admin.password_reset': { text: 'dio un enlace para restablecer la contraseña a', kind: 'access', icon: 'lock', tone: 'amber' },
};

export const HISTORY_FILTERS: { key: HistoryKind; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'invitations', label: 'Invitaciones' },
  { key: 'access', label: 'Accesos' },
  { key: 'codes', label: 'Códigos de seguridad' },
  { key: 'sessions', label: 'Sesiones cerradas' },
];

export const teamEventLook = (action: PlatformTeamAction) => TEAM_EVENT[action];

/** «Yornel» + «quitó el acceso a» + «Carla Díaz»; joining has no subject. */
export function teamEventText(event: TeamEvent): { actor: string; text: string; subject: string | null } {
  const look = TEAM_EVENT[event.action];
  return { actor: event.actorName, text: look.text, subject: event.action === 'admin.joined' ? null : (event.subjectName ?? event.subjectEmail) };
}

export type ActivityKind = 'all' | 'companies' | 'numbers' | 'invitations' | 'types';

const CONSOLE_ACTION: Record<ConsoleAction, { text: string; kind: Exclude<ActivityKind, 'all'>; icon: IconName; tone: string }> = {
  'tenant.created': { text: 'dio de alta a', kind: 'companies', icon: 'plus', tone: 'green' },
  'tenant.updated': { text: 'editó los datos de', kind: 'companies', icon: 'edit', tone: 'blue' },
  'tenant.draft_discarded': { text: 'descartó el borrador de', kind: 'companies', icon: 'trash', tone: 'gray' },
  'tenant.activated': { text: 'activó', kind: 'companies', icon: 'check', tone: 'green' },
  'tenant.suspended': { text: 'suspendió', kind: 'companies', icon: 'alert', tone: 'amber' },
  'tenant.cancelled': { text: 'dio de baja a', kind: 'companies', icon: 'x', tone: 'red' },
  'channel.connected': { text: 'conectó un número de', kind: 'numbers', icon: 'phone', tone: 'green' },
  'channel.replaced': { text: 'cambió un número o su clave en', kind: 'numbers', icon: 'swap', tone: 'blue' },
  'channel.refreshed': { text: 'actualizó desde Meta un número de', kind: 'numbers', icon: 'swap', tone: 'gray' },
  'tenant.admin_invited': { text: 'invitó a un administrador de', kind: 'invitations', icon: 'mail', tone: 'blue' },
  'tenant.owner_invited': { text: 'invitó al dueño de', kind: 'invitations', icon: 'mail', tone: 'blue' },
  'tenant.invitation_renewed': { text: 'renovó una invitación de', kind: 'invitations', icon: 'mail', tone: 'gray' },
  'tenant.invitation_revoked': { text: 'anuló una invitación de', kind: 'invitations', icon: 'x', tone: 'gray' },
  'business_type.created': { text: 'creó un rubro nuevo', kind: 'types', icon: 'tag', tone: 'blue' },
  'business_type.reclassified': { text: 'reclasificó empresas a otro rubro', kind: 'types', icon: 'tag', tone: 'gray' },
  'tenant.password_reset': { text: 'dio un enlace para restablecer una contraseña en', kind: 'invitations', icon: 'lock', tone: 'amber' },
  'tenant.owner_changed': { text: 'cambió el dueño de', kind: 'companies', icon: 'swap', tone: 'blue' },
};

export const ACTIVITY_FILTERS: { key: ActivityKind; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'companies', label: 'Empresas' },
  { key: 'numbers', label: 'Números' },
  { key: 'invitations', label: 'Invitaciones' },
  { key: 'types', label: 'Rubros' },
];

export const activityLook = (action: ConsoleAction) => CONSOLE_ACTION[action];

/** The activity of one person and/or one kind; null person = everyone. */
export function filterActivity(entries: ActivityEntry[], kind: ActivityKind, personId: string | null): ActivityEntry[] {
  return entries.filter((e) => (kind === 'all' || CONSOLE_ACTION[e.action].kind === kind) && (!personId || e.actorUserId === personId));
}

export function filterHistory(events: TeamEvent[], kind: HistoryKind): TeamEvent[] {
  return kind === 'all' ? events : events.filter((e) => TEAM_EVENT[e.action].kind === kind);
}

/** Search box: by name or email, ignoring case and accents. */
export function matchesPerson(person: { name: string; email: string }, query: string): boolean {
  const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = fold(query.trim());
  return !q || fold(person.name).includes(q) || fold(person.email).includes(q);
}
