import { Injectable, computed, inject } from '@angular/core';
import { Clock } from '../../core/clock';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import type { AuditAction, ChannelAccount, Id, Membership, TenantRole } from '../../shared/api/models';
import { newId } from '../../shared/api/mock-db';
import { type MemberChange, inviteError, memberChangeError } from './team.rules';

const INVITATION_TTL_MS = 72 * 3_600_000;

export interface InviteInput {
  name: string;
  email: string;
  role: TenantRole;
  channelAccountIds: Id[];
  canSeeOthers: boolean;
}

/** Team and number management of the active company. Returns an error message instead of acting when a rule says no. */
@Injectable({ providedIn: 'root' })
export class TeamActions {
  private readonly directory = inject(Directory);
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);

  private readonly tenantId = computed(() => this.session.tenant()?.id ?? '');
  readonly memberships = computed(() => this.directory.memberships().filter((m) => m.tenantId === this.tenantId()));
  readonly pendingInvitations = computed(() =>
    this.directory.invitations().filter((i) => i.tenantId === this.tenantId() && !i.acceptedAt),
  );

  invite(input: InviteInput): string | null {
    const tenant = this.session.tenant();
    if (!tenant) return 'Sin empresa activa.';
    const email = input.email.trim().toLowerCase();
    const existing = this.directory.findUserByEmail(email);
    const error = inviteError(this.memberships(), tenant.plan, existing?.id ?? null);
    if (error) return error;

    const userId = existing?.id ?? newId('usr');
    if (!existing) this.directory.addUser({ id: userId, name: input.name.trim(), email, platformRole: null });
    this.directory.upsertMembership({
      tenantId: tenant.id,
      userId,
      role: input.role,
      status: 'invited',
      channelAccountIds: input.channelAccountIds,
      canSeeOthers: input.role === 'admin' || input.canSeeOthers,
    });
    const now = this.clock.now();
    this.directory.addInvitation({
      id: newId('inv'),
      tenantId: tenant.id,
      email,
      name: input.name.trim(),
      role: input.role,
      invitedByUserId: this.session.user()?.id ?? 'system',
      demoToken: `demo-${newId('tok').slice(4)}`,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
      acceptedAt: null,
      createdAt: now.toISOString(),
    });
    this.audit('invitation.sent', `Invitación a ${email}`);
    return null;
  }

  updateMember(userId: Id, patch: Partial<Pick<Membership, 'role' | 'channelAccountIds' | 'canSeeOthers'>>): string | null {
    if (patch.role) {
      const error = memberChangeError(this.memberships(), userId, { kind: 'role', role: patch.role }, this.session.user()?.id ?? null);
      if (error) return error;
    }
    const current = this.memberships().find((m) => m.userId === userId);
    if (!current) return 'Esa persona ya no está en el equipo.';
    const next = { ...current, ...patch };
    // Admins always see every conversation of their company.
    this.directory.upsertMembership({ ...next, canSeeOthers: next.role === 'admin' || next.canSeeOthers });
    return null;
  }

  removeMember(userId: Id): string | null {
    const change: MemberChange = { kind: 'remove' };
    const error = memberChangeError(this.memberships(), userId, change, this.session.user()?.id ?? null);
    if (error) return error;
    const email = this.directory.userById().get(userId)?.email ?? '';
    this.directory.removeMembership(this.tenantId(), userId);
    this.pendingInvitations()
      .filter((i) => i.email === email)
      .forEach((i) => this.directory.removeInvitation(i.id));
    return null;
  }

  resendInvitation(invitationId: Id): void {
    const now = this.clock.now();
    this.directory.updateInvitation(invitationId, {
      demoToken: `demo-${newId('tok').slice(4)}`,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
      createdAt: now.toISOString(),
    });
  }

  updateChannel(channelId: Id, patch: Partial<Pick<ChannelAccount, 'label' | 'color'>>): void {
    this.directory.updateChannel(channelId, patch);
  }

  private audit(action: AuditAction, detail: string): void {
    this.directory.record({
      id: newId('aud'),
      tenantId: this.tenantId(),
      actorUserId: this.session.user()?.id ?? 'system',
      action,
      detail,
      createdAt: this.clock.now().toISOString(),
    });
  }
}
