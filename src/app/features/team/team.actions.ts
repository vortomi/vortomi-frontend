import { Injectable, computed, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Clock } from '../../core/clock';
import { Directory } from '../../core/directory';
import { RemoteSession } from '../../core/remote/remote-session';
import { Session } from '../../core/session';
import type { ApiInvitation } from '../../shared/api/contract';
import type { AuditAction, ChannelAccount, Id, IsoDate, Membership, TenantRole, User } from '../../shared/api/models';
import { newId } from '../../shared/api/mock-db';
import { type InviteRequest, type MemberAccess, TeamRemote } from './team-remote';
import { type MemberChange, inviteError, memberChangeError, seatsUsed } from './team.rules';

const INVITATION_TTL_MS = 72 * 3_600_000;

export interface TeamMemberRow {
  user: User;
  membership: Membership;
}

export interface PendingInvitation {
  id: Id;
  name: string;
  email: string;
  role: TenantRole;
  expiresAt: IsoDate;
}

/** A created or renewed invitation gives its link once: the server keeps only a fingerprint of it. */
export type InviteResult = { error: string } | { link: string };

/** The page the link opens, on this same panel. */
const linkFor = (token: string) => `${window.location.origin}/invitation/${encodeURIComponent(token)}`;

/**
 * Team and number management of the active company. Every change resolves to an error message
 * (or null when done), so the screen confirms only what really happened.
 * - 'mock': the prototype tables, in memory.
 * - 'api':  vortomi-backend; after each change the team and the company data are read again,
 *           so the inbox's assignment list follows at once.
 */
@Injectable({ providedIn: 'root' })
export class TeamActions {
  private readonly directory = inject(Directory);
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(TeamRemote) : null;
  private readonly remoteSession = inject(RemoteSession);

  private readonly tenantId = computed(() => this.session.tenant()?.id ?? '');
  private readonly remoteMembers = signal<TeamMemberRow[]>([]);
  private readonly remoteInvitations = signal<PendingInvitation[]>([]);

  /** Everyone in the company, disabled people included (they can be brought back). */
  readonly members = computed<TeamMemberRow[]>(() => {
    if (this.remote) return this.remoteMembers();
    const users = this.directory.userById();
    return this.mockMemberships()
      .filter((m) => m.status !== 'invited')
      .flatMap((membership) => {
        const user = users.get(membership.userId);
        return user ? [{ user, membership }] : [];
      });
  });

  readonly pendingInvitations = computed<PendingInvitation[]>(() => {
    if (this.remote) return this.remoteInvitations();
    return this.directory
      .invitations()
      .filter((i) => i.tenantId === this.tenantId() && !i.acceptedAt)
      .map(({ id, name, email, role, expiresAt }) => ({ id, name, email, role, expiresAt }));
  });

  /** Memberships the seat and last-admin rules count: people plus pending invitations. */
  private readonly ruleMemberships = computed<Membership[]>(() => [
    ...this.members().map((row) => row.membership),
    ...this.pendingInvitations().map(
      (i): Membership => ({ tenantId: this.tenantId(), userId: i.id, role: i.role, status: 'invited', channelAccountIds: [], canSeeOthers: false }),
    ),
  ]);

  private readonly mockMemberships = computed(() => this.directory.memberships().filter((m) => m.tenantId === this.tenantId()));

  /** 'api' mode: reads the team screen's data. The mock tables are always there. */
  async load(): Promise<string | null> {
    const remote = this.remote;
    const tenantId = this.tenantId();
    if (!remote || !tenantId) return null;
    try {
      const [members, invitations] = await Promise.all([remote.members(tenantId), remote.invitations(tenantId)]);
      this.remoteMembers.set(members);
      this.remoteInvitations.set(invitations.map(toPending));
      return null;
    } catch (error) {
      return toApiFailure(error).message;
    }
  }

  /** Seats of the plan in use: active people and pending invitations (disabled ones free theirs). */
  readonly seatsUsed = computed(() => seatsUsed(this.ruleMemberships()));

  async invite(request: InviteRequest): Promise<InviteResult> {
    const tenant = this.session.tenant();
    if (!tenant) return { error: 'Sin empresa activa.' };
    const email = request.email.trim().toLowerCase();
    const existing = this.members().find((row) => row.user.email === email);
    const error = inviteError(this.ruleMemberships(), tenant.plan, existing?.user.id ?? null);
    if (error) return { error };
    const clean = { ...request, email, name: request.name.trim(), canSeeOthers: request.role === 'admin' || request.canSeeOthers };

    if (this.remote) {
      const remote = this.remote;
      return this.change(async (tenantId) => {
        const created = await remote.invite(tenantId, clean);
        return { link: linkFor(created.token ?? '') };
      });
    }
    return { link: linkFor(this.inviteLocal(clean)) };
  }

  /** A fresh link for an open invitation; the previous one stops working. */
  async renew(invitationId: Id): Promise<InviteResult> {
    if (this.remote) {
      const remote = this.remote;
      return this.change(async (tenantId) => ({ link: linkFor((await remote.renew(tenantId, invitationId)).token ?? '') }));
    }
    const token = `demo-${newId('tok').slice(4)}`;
    this.directory.updateInvitation(invitationId, { demoToken: token, expiresAt: this.expiry(), createdAt: this.clock.now().toISOString() });
    return { link: linkFor(token) };
  }

  async revoke(invitationId: Id): Promise<string | null> {
    if (this.remote) {
      const remote = this.remote;
      return this.errorOf(await this.change(async (tenantId) => remote.revoke(tenantId, invitationId)));
    }
    const invitation = this.directory.invitations().find((i) => i.id === invitationId);
    if (invitation) {
      const user = this.directory.findUserByEmail(invitation.email);
      if (user) this.directory.removeMembership(this.tenantId(), user.id);
      this.directory.removeInvitation(invitationId);
    }
    return null;
  }

  async updateMember(userId: Id, access: MemberAccess): Promise<string | null> {
    const ruleError = memberChangeError(this.ruleMemberships(), userId, { kind: 'role', role: access.role }, this.session.user()?.id ?? null);
    if (ruleError) return ruleError;
    const clean = { ...access, canSeeOthers: access.role === 'admin' || access.canSeeOthers };
    if (this.remote) {
      const remote = this.remote;
      return this.errorOf(await this.change(async (tenantId) => remote.updateMember(tenantId, userId, clean)));
    }
    const current = this.mockMemberships().find((m) => m.userId === userId);
    if (!current) return 'Esa persona ya no está en el equipo.';
    this.directory.upsertMembership({ ...current, ...clean });
    return null;
  }

  /** Disabling keeps the person's history; they simply cannot enter until brought back. */
  async setActive(userId: Id, active: boolean): Promise<string | null> {
    if (!active) {
      const change: MemberChange = { kind: 'remove' };
      const ruleError = memberChangeError(this.ruleMemberships(), userId, change, this.session.user()?.id ?? null);
      if (ruleError) return ruleError;
    }
    const status = active ? 'active' : 'disabled';
    if (this.remote) {
      const remote = this.remote;
      return this.errorOf(await this.change(async (tenantId) => remote.setStatus(tenantId, userId, status)));
    }
    const current = this.mockMemberships().find((m) => m.userId === userId);
    if (current) this.directory.upsertMembership({ ...current, status });
    return null;
  }

  async updateChannel(channelId: Id, patch: Pick<ChannelAccount, 'label' | 'color'>): Promise<string | null> {
    if (this.remote) {
      const remote = this.remote;
      // The server keeps the name; the colour stays a panel choice until it has a place there.
      return this.errorOf(await this.change(async (tenantId) => remote.renameChannel(tenantId, channelId, patch.label)));
    }
    this.directory.updateChannel(channelId, patch);
    return null;
  }

  /** 'api' mode: runs a change, then reads the team and the company again. */
  private async change<T>(work: (tenantId: Id) => Promise<T>): Promise<T | { error: string }> {
    const tenantId = this.tenantId();
    try {
      const result = await work(tenantId);
      await Promise.all([this.load(), this.remoteSession.loadCompany(tenantId)]);
      return result;
    } catch (error) {
      return { error: toApiFailure(error).message };
    }
  }

  private errorOf(result: unknown): string | null {
    return typeof result === 'object' && result !== null && 'error' in result ? String((result as { error: string }).error) : null;
  }

  private inviteLocal(request: InviteRequest): string {
    const tenantId = this.tenantId();
    const existing = this.directory.findUserByEmail(request.email);
    const userId = existing?.id ?? newId('usr');
    if (!existing) this.directory.addUser({ id: userId, name: request.name, email: request.email, platformRole: null });
    this.directory.upsertMembership({ tenantId, userId, role: request.role, status: 'invited', channelAccountIds: request.channelAccountIds, canSeeOthers: request.canSeeOthers });
    const token = `demo-${newId('tok').slice(4)}`;
    this.directory.addInvitation({
      id: newId('inv'),
      tenantId,
      email: request.email,
      name: request.name,
      role: request.role,
      invitedByUserId: this.session.user()?.id ?? 'system',
      demoToken: token,
      expiresAt: this.expiry(),
      acceptedAt: null,
      createdAt: this.clock.now().toISOString(),
    });
    this.audit('invitation.sent', `Invitación a ${request.email}`);
    return token;
  }

  private expiry(): IsoDate {
    return new Date(this.clock.now().getTime() + INVITATION_TTL_MS).toISOString();
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

const toPending = (row: ApiInvitation): PendingInvitation => ({ id: row.id, name: row.name, email: row.email, role: row.role, expiresAt: row.expiresAt });
