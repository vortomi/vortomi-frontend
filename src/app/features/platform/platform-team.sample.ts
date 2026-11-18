// Preview mode (no server): a steady sample staff so «Staff» can be seen. Never real data.
import type { ApiPlatformTeam } from '../../shared/api/contract';

const at = (now: Date, minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();

export function sampleTeam(now: Date): ApiPlatformTeam {
  const me = 'usr_yornel';
  const luis = 'usr_luis_staff';
  const ana = 'usr_ana_staff';
  return {
    admins: [
      { userId: ana, name: 'Ana Rojas', email: 'ana@vortexautonomy.com', createdAt: at(now, 60 * 20), hasCode: false, isYou: false, invitedBy: 'Luis Villegas', lastSignInAt: null, codeSince: null, codeLastUsedAt: null, sessionCount: 0, lastActionAt: null },
      { userId: luis, name: 'Luis Villegas', email: 'luis@vortexautonomy.com', createdAt: at(now, 60 * 30), hasCode: true, isYou: false, invitedBy: 'Yornel Marval', lastSignInAt: at(now, 12), codeSince: at(now, 60 * 30), codeLastUsedAt: at(now, 12), sessionCount: 2, lastActionAt: at(now, 40) },
      { userId: me, name: 'Yornel Marval', email: 'yornel@vortomi.com', createdAt: at(now, 60 * 24 * 20), hasCode: true, isYou: true, invitedBy: null, lastSignInAt: at(now, 0), codeSince: at(now, 60 * 24 * 20), codeLastUsedAt: at(now, 90), sessionCount: 2, lastActionAt: at(now, 15) },
    ],
    invitations: [{ id: 'inv_pedro', name: 'Pedro Gómez', email: 'pedro@vortexautonomy.com', expiresAt: at(now, -60 * 20), createdAt: at(now, 60 * 52), invitedBy: 'Yornel Marval' }],
    sessions: [
      { id: 's1', userId: me, name: 'Yornel Marval', browser: 'Chrome', system: 'macOS', mobile: false, ip: '190.75.x.x', createdAt: at(now, 60 * 3), lastActiveAt: at(now, 0), current: true },
      { id: 's2', userId: luis, name: 'Luis Villegas', browser: 'Chrome', system: 'Windows', mobile: false, ip: '190.205.x.x', createdAt: at(now, 60 * 30), lastActiveAt: at(now, 12), current: false },
      { id: 's3', userId: luis, name: 'Luis Villegas', browser: 'Safari', system: 'iPhone', mobile: true, ip: '186.92.x.x', createdAt: at(now, 60 * 30), lastActiveAt: at(now, 60 * 24), current: false },
      { id: 's4', userId: me, name: 'Yornel Marval', browser: 'Edge', system: 'Windows', mobile: false, ip: '200.44.x.x', createdAt: at(now, 60 * 24 * 9), lastActiveAt: at(now, 60 * 24 * 9), current: false },
    ],
    events: [
      { action: 'admin.invitation_renewed', actorName: 'Yornel Marval', subjectEmail: 'pedro@vortexautonomy.com', subjectName: null, createdAt: at(now, 50) },
      { action: 'admin.joined', actorName: 'Ana Rojas', subjectEmail: 'ana@vortexautonomy.com', subjectName: 'Ana Rojas', createdAt: at(now, 60 * 20) },
      { action: 'admin.code_reset', actorName: 'Yornel Marval', subjectEmail: 'luis@vortexautonomy.com', subjectName: 'Luis Villegas', createdAt: at(now, 60 * 22) },
      { action: 'admin.session_ended', actorName: 'Luis Villegas', subjectEmail: 'yornel@vortomi.com', subjectName: 'Yornel Marval', createdAt: at(now, 60 * 27) },
      { action: 'admin.removed', actorName: 'Yornel Marval', subjectEmail: 'carla@vortexautonomy.com', subjectName: 'Carla Díaz', createdAt: at(now, 60 * 48) },
    ],
    activity: [
      { action: 'tenant.suspended', actorUserId: me, actorName: 'Yornel Marval', tenantId: 'ten_sonrisa', tenantName: 'Clínica Dental Sonrisa', createdAt: at(now, 15) },
      { action: 'channel.replaced', actorUserId: luis, actorName: 'Luis Villegas', tenantId: 'ten_ra', tenantName: 'Repuestos Andinos', createdAt: at(now, 40) },
      { action: 'tenant.owner_invited', actorUserId: me, actorName: 'Yornel Marval', tenantId: 'ten_ortiz', tenantName: 'Taller Ortiz', createdAt: at(now, 60 * 5) },
      { action: 'tenant.created', actorUserId: me, actorName: 'Yornel Marval', tenantId: 'ten_ortiz', tenantName: 'Taller Ortiz', createdAt: at(now, 60 * 5 + 3) },
      { action: 'tenant.updated', actorUserId: luis, actorName: 'Luis Villegas', tenantId: 'ten_valle', tenantName: 'Mueblería Valle', createdAt: at(now, 60 * 26) },
      { action: 'business_type.created', actorUserId: luis, actorName: 'Luis Villegas', tenantId: null, tenantName: null, createdAt: at(now, 60 * 30) },
    ],
  };
}
