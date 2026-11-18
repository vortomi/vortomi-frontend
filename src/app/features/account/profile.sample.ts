// Preview mode (no server): a steady sample profile so «Mi perfil» can be seen. Never real data.
import type { ApiMyProfile } from '../../shared/api/contract';

const at = (now: Date, minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();

export function sampleProfile(person: { name: string; email: string }, staff: boolean, companies: ApiMyProfile['companies'], now: Date): ApiMyProfile {
  return {
    name: person.name,
    email: person.email,
    staff,
    memberSince: at(now, 60 * 24 * 20),
    invitedBy: staff ? null : 'Laura Méndez',
    lastSignInAt: at(now, 2),
    code: staff ? { since: at(now, 60 * 24 * 20), lastUsedAt: at(now, 2) } : null,
    companies,
    sessions: [
      { id: 'me-1', browser: 'Chrome', system: 'macOS', mobile: false, ip: '190.75.x.x', createdAt: at(now, 4), lastActiveAt: at(now, 0), current: true },
      { id: 'me-2', browser: 'Edge', system: 'Windows', mobile: false, ip: '200.44.x.x', createdAt: at(now, 60 * 24 * 9), lastActiveAt: at(now, 60 * 24 * 9), current: false },
    ],
    activity: staff
      ? [
          { action: 'tenant.suspended', target: 'Clínica Dental Sonrisa', createdAt: at(now, 15) },
          { action: 'tenant.owner_invited', target: 'Taller Ortiz', createdAt: at(now, 60 * 5) },
          { action: 'tenant.created', target: 'Taller Ortiz', createdAt: at(now, 60 * 5 + 3) },
          { action: 'admin.code_reset', target: 'Luis Villegas', createdAt: at(now, 60 * 22) },
        ]
      : [],
  };
}
