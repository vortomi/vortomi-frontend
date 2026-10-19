import { httpResource } from '@angular/common/http';
import { Injectable, computed, linkedSignal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import type {
  AuditEntry,
  ChannelAccount,
  Id,
  Invitation,
  Membership,
  Tenant,
  UsageMonth,
  User,
} from '../shared/api/models';
import { allLoaded, mockTableUrl } from '../shared/api/mock-db';

const replaceWhere = <T>(rows: T[], match: (row: T) => boolean, patch: Partial<T>): T[] =>
  rows.map((row) => (match(row) ? { ...row, ...patch } : row));

/**
 * Platform-wide tables: companies, people, memberships, invitations, numbers, usage and audit.
 * Edits stay in memory until reload. In production each read goes through the API, which
 * scopes it by role; here the screens and guards do the scoping for display only.
 */
@Injectable({ providedIn: 'root' })
export class Directory {
  private readonly tenantRows = httpResource<Tenant[]>(() => mockTableUrl('tenants'), { defaultValue: [] });
  private readonly userRows = httpResource<User[]>(() => mockTableUrl('users'), { defaultValue: [] });
  private readonly membershipRows = httpResource<Membership[]>(() => mockTableUrl('memberships'), {
    defaultValue: [],
  });
  private readonly invitationRows = httpResource<Invitation[]>(() => mockTableUrl('invitations'), {
    defaultValue: [],
  });
  private readonly channelRows = httpResource<ChannelAccount[]>(() => mockTableUrl('channel-accounts'), {
    defaultValue: [],
  });
  private readonly usageRows = httpResource<UsageMonth[]>(() => mockTableUrl('usage'), { defaultValue: [] });
  private readonly auditRows = httpResource<AuditEntry[]>(() => mockTableUrl('audit-log'), { defaultValue: [] });

  readonly tenants = linkedSignal(() => this.tenantRows.value());
  readonly users = linkedSignal(() => this.userRows.value());
  readonly memberships = linkedSignal(() => this.membershipRows.value());
  readonly invitations = linkedSignal(() => this.invitationRows.value());
  readonly channels = linkedSignal(() => this.channelRows.value());
  readonly usage = linkedSignal(() => this.usageRows.value());
  readonly audit = linkedSignal(() => this.auditRows.value());

  readonly ready = computed(() =>
    allLoaded(
      this.tenantRows,
      this.userRows,
      this.membershipRows,
      this.invitationRows,
      this.channelRows,
      this.usageRows,
      this.auditRows,
    ),
  );

  /** Resolves once every table is loaded; guards wait on it before deciding. */
  readonly loaded: Promise<void> = firstValueFrom(toObservable(this.ready).pipe(filter(Boolean))).then(() => undefined);

  readonly userById = computed(() => new Map(this.users().map((u) => [u.id, u])));
  readonly tenantById = computed(() => new Map(this.tenants().map((t) => [t.id, t])));

  findUserByEmail(email: string): User | null {
    const needle = email.trim().toLowerCase();
    return this.users().find((u) => u.email.toLowerCase() === needle) ?? null;
  }

  addTenant(tenant: Tenant): void {
    this.tenants.update((rows) => [...rows, tenant]);
  }

  updateTenant(id: Id, patch: Partial<Tenant>): void {
    this.tenants.update((rows) => replaceWhere(rows, (t) => t.id === id, patch));
  }

  addUser(user: User): void {
    this.users.update((rows) => [...rows, user]);
  }

  updateUser(id: Id, patch: Partial<User>): void {
    this.users.update((rows) => replaceWhere(rows, (u) => u.id === id, patch));
  }

  /** Inserts the membership or updates it when the person already belongs to the company. */
  upsertMembership(membership: Membership): void {
    this.memberships.update((rows) => {
      const exists = rows.some((m) => m.tenantId === membership.tenantId && m.userId === membership.userId);
      return exists
        ? replaceWhere(rows, (m) => m.tenantId === membership.tenantId && m.userId === membership.userId, membership)
        : [...rows, membership];
    });
  }

  removeMembership(tenantId: Id, userId: Id): void {
    this.memberships.update((rows) => rows.filter((m) => !(m.tenantId === tenantId && m.userId === userId)));
  }

  removeInvitation(id: Id): void {
    this.invitations.update((rows) => rows.filter((i) => i.id !== id));
  }

  addInvitation(invitation: Invitation): void {
    this.invitations.update((rows) => [...rows, invitation]);
  }

  updateInvitation(id: Id, patch: Partial<Invitation>): void {
    this.invitations.update((rows) => replaceWhere(rows, (i) => i.id === id, patch));
  }

  addChannel(channel: ChannelAccount): void {
    this.channels.update((rows) => [...rows, channel]);
  }

  updateChannel(id: Id, patch: Partial<ChannelAccount>): void {
    this.channels.update((rows) => replaceWhere(rows, (c) => c.id === id, patch));
  }

  addUsage(usage: UsageMonth): void {
    this.usage.update((rows) => [...rows, usage]);
  }

  record(entry: AuditEntry): void {
    this.audit.update((rows) => [...rows, entry]);
  }
}
