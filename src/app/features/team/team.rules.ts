// Pure team rules: who is on the team and changes that would lock a company out of itself. No plan
// limits the number of people (documentations/18): a limit may come back later with a plan.
import type { Id, Membership } from '../../shared/api/models';

/** People on the team, pending invitations included. */
export function seatsUsed(memberships: Membership[]): number {
  return memberships.filter((m) => m.status === 'active' || m.status === 'invited').length;
}

export type MemberChange = { kind: 'remove' } | { kind: 'role'; role: Membership['role'] };

/** Returns why a change is not allowed, or null when it is fine. */
export function memberChangeError(memberships: Membership[], target: Id, change: MemberChange, actingUserId: Id | null): string | null {
  if (target === actingUserId && change.kind === 'remove') return 'No puedes quitarte a ti mismo. Pídeselo a otra persona de administración.';
  const member = memberships.find((m) => m.userId === target);
  if (!member) return 'Esa persona ya no está en el equipo.';
  const losesAdmin = member.role === 'admin' && (change.kind === 'remove' || change.role !== 'admin');
  const otherAdmins = memberships.filter((m) => m.role === 'admin' && m.status === 'active' && m.userId !== target).length;
  if (losesAdmin && member.status === 'active' && otherAdmins === 0) {
    return 'La empresa debe tener al menos una persona en administración.';
  }
  return null;
}

export function inviteError(memberships: Membership[], emailOwnerId: Id | null): string | null {
  if (emailOwnerId && memberships.some((m) => m.userId === emailOwnerId)) return 'Esa persona ya está en el equipo o tiene una invitación pendiente.';
  return null;
}
