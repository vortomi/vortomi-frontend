// Pure team rules: seats per plan and changes that would lock a company out of itself.
import type { Id, Membership, TenantPlan } from '../../shared/api/models';

/** People per plan (labels.ts shows the same numbers). Pending invitations take a seat. */
export const PLAN_SEATS: Record<TenantPlan, number> = { internal: 10, basic: 2, team: 5 };

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

export function inviteError(memberships: Membership[], plan: TenantPlan, emailOwnerId: Id | null): string | null {
  if (emailOwnerId && memberships.some((m) => m.userId === emailOwnerId)) return 'Esa persona ya está en el equipo o tiene una invitación pendiente.';
  if (seatsUsed(memberships) >= PLAN_SEATS[plan]) return 'El plan ya no tiene usuarios libres. Quita a alguien o cambia de plan.';
  return null;
}
