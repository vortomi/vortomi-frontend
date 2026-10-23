import { Injectable, computed, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Clock } from '../../core/clock';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import type { ApiPlatformTenant, ApiPlatformTenantDetail } from '../../shared/api/contract';
import { toChannel, toUsage } from '../../shared/api/mappers';
import type {
  AuditAction,
  ChannelAccount,
  ChannelStatus,
  Id,
  IsoDate,
  Membership,
  QualityRating,
  Tenant,
  TenantStatus,
  UsageMonth,
  User,
} from '../../shared/api/models';
import { newId } from '../../shared/api/mock-db';
import { type MetaSpend, estimateSpend } from '../../shared/billing/meta-pricing';
import { calendarDay } from '../../shared/format/date-time';
import { platformAlerts } from './platform-alerts';
import { PlatformRemote } from './platform-remote';

export interface TenantRow {
  tenant: Tenant;
  channels: ChannelAccount[];
  memberCount: number;
  /** Meta consumption of this month across its numbers, or null before its first message. */
  usage: MetaSpend | null;
  /** Worst state among its numbers, or null when it has none yet. */
  channelStatus: ChannelStatus | null;
  worstQuality: QualityRating | null;
}

export interface MemberRow {
  user: User;
  membership: Membership;
}

/** An open invitation as the console shows it. The link itself is only shown when created or renewed. */
export interface PlatformInvitation {
  id: Id;
  email: string;
  name: string;
  expiresAt: IsoDate;
}

const STATUS_RANK: Record<ChannelStatus, number> = { connected: 0, restricted: 1, disconnected: 2 };
const QUALITY_RANK: Record<QualityRating, number> = { high: 0, medium: 1, low: 2 };
const INVITATION_TTL_MS = 72 * 3_600_000;
/** Usage months are counted in Venezuela's calendar, like the companies' reports. */
const PLATFORM_ZONE = 'America/Caracas';

const worst = <T extends string>(values: T[], rank: Record<T, number>): T | null =>
  values.reduce<T | null>((acc, v) => (acc === null || rank[v] > rank[acc] ? v : acc), null);

/** The page an invitation link opens, on this same panel. */
export const invitationLink = (token: string) => `${window.location.origin}/invitation/${encodeURIComponent(token)}`;

/**
 * Read model and actions of the platform console. Never touches conversations.
 * - 'mock': the prototype tables in Directory.
 * - 'api':  vortomi-backend's /platform routes (our team, with the second factor).
 */
@Injectable({ providedIn: 'root' })
export class PlatformData {
  private readonly directory = inject(Directory);
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(PlatformRemote) : null;

  /** The console of the real server keeps no audit trail yet; the prototype shows one. */
  readonly hasAudit = !this.remote;

  private readonly remoteTenants = signal<ApiPlatformTenant[]>([]);
  private readonly remoteUsage = signal<UsageMonth[]>([]);
  private readonly remoteLoaded = signal(false);
  private readonly remoteDetail = signal<ApiPlatformTenantDetail | null>(null);

  readonly ready = computed(() => (this.remote ? this.remoteLoaded() : this.directory.ready()));

  private readonly tenants = computed<Tenant[]>(() => (this.remote ? this.remoteTenants().map(toTenantModel) : this.directory.tenants()));
  private readonly channels = computed<ChannelAccount[]>(() => {
    if (!this.remote) return this.directory.channels();
    return this.remoteTenants().flatMap((t) =>
      t.channels.map((c, index) => toChannel(t.id, { ...c, phoneNumberId: '', wabaId: '' }, index)),
    );
  });
  private readonly usageRows = computed(() => (this.remote ? this.remoteUsage() : this.directory.usage()));

  readonly rows = computed<TenantRow[]>(() => {
    const channels = this.channels();
    const usage = this.usageRows();
    const members = this.remote ? new Map(this.remoteTenants().map((t) => [t.id, t.memberCount])) : null;
    return this.tenants().map((tenant) => {
      const own = channels.filter((c) => c.tenantId === tenant.id);
      const ownUsage = usage.filter((u) => u.tenantId === tenant.id);
      return {
        tenant,
        channels: own,
        memberCount:
          members?.get(tenant.id) ?? this.directory.memberships().filter((m) => m.tenantId === tenant.id && m.status === 'active').length,
        usage: ownUsage.length ? estimateSpend(ownUsage) : null,
        channelStatus: worst(own.map((c) => c.status), STATUS_RANK),
        worstQuality: worst(own.map((c) => c.qualityRating), QUALITY_RANK),
      };
    });
  });

  readonly alerts = computed(() => platformAlerts(this.tenants(), this.channels(), this.clock.now()));

  readonly kpis = computed(() => ({
    activeTenants: this.tenants().filter((t) => t.status === 'active').length,
    connectedNumbers: this.channels().filter((c) => c.status === 'connected').length,
    monthMessages: this.usageRows().reduce((sum, u) => sum + u.totalMessages, 0),
    openAlerts: this.alerts().length,
  }));

  /** 'api' mode: the company list and this month's usage. Resolves to an error message, or null. */
  async load(): Promise<string | null> {
    const remote = this.remote;
    if (!remote) return null;
    try {
      const month = calendarDay(this.clock.now().toISOString(), PLATFORM_ZONE).slice(0, 7);
      const [tenants, usage] = await Promise.all([remote.tenants(), remote.usage(month)]);
      this.remoteTenants.set(tenants);
      this.remoteUsage.set(usage.map(toUsage));
      return null;
    } catch (error) {
      return toApiFailure(error).message;
    } finally {
      this.remoteLoaded.set(true);
    }
  }

  /** 'api' mode: one company's people and invitations, for its page. */
  async loadDetail(tenantId: Id): Promise<string | null> {
    const remote = this.remote;
    if (!remote) return null;
    try {
      this.remoteDetail.set(await remote.tenant(tenantId));
      return null;
    } catch (error) {
      return toApiFailure(error).message;
    }
  }

  row(tenantId: Id | undefined): TenantRow | null {
    return this.rows().find((r) => r.tenant.id === tenantId) ?? null;
  }

  members(tenantId: Id): MemberRow[] {
    if (this.remote) {
      const detail = this.remoteDetail();
      if (detail?.id !== tenantId) return [];
      return detail.members.map((m) => ({
        user: { id: m.userId, name: m.name, email: m.email, platformRole: null },
        membership: { tenantId, userId: m.userId, role: m.role, status: m.status, channelAccountIds: [], canSeeOthers: m.role === 'admin' },
      }));
    }
    const users = this.directory.userById();
    return this.directory
      .memberships()
      .filter((m) => m.tenantId === tenantId && m.status !== 'invited')
      .flatMap((membership) => {
        const user = users.get(membership.userId);
        return user ? [{ user, membership }] : [];
      });
  }

  pendingInvitations(tenantId: Id): PlatformInvitation[] {
    if (this.remote) {
      const detail = this.remoteDetail();
      return detail?.id === tenantId ? detail.invitations.map(({ id, email, name, expiresAt }) => ({ id, email, name, expiresAt })) : [];
    }
    return this.directory
      .invitations()
      .filter((i) => i.tenantId === tenantId && !i.acceptedAt)
      .map(({ id, email, name, expiresAt }) => ({ id, email, name, expiresAt }));
  }

  auditTrail(tenantId: Id) {
    return this.directory
      .audit()
      .filter((a) => a.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Resolves to an error message, or null once the status changed. */
  async setStatus(tenantId: Id, status: Extract<TenantStatus, 'active' | 'suspended'>): Promise<string | null> {
    const remote = this.remote;
    if (remote) {
      try {
        await remote.setStatus(tenantId, status);
        await this.load();
        return null;
      } catch (error) {
        return toApiFailure(error).message;
      }
    }
    const tenant = this.directory.tenantById().get(tenantId);
    if (!tenant || tenant.status === status) return null;
    const reactivating = tenant.status === 'suspended' && status === 'active';
    this.directory.updateTenant(tenantId, { status });
    this.audit(
      tenantId,
      status === 'suspended' ? 'tenant.suspended' : reactivating ? 'tenant.reactivated' : 'tenant.activated',
      status === 'suspended' ? 'Acceso suspendido; los datos se conservan' : 'Acceso restablecido',
    );
    return null;
  }

  /** A fresh link with a new 72 h window; the old one stops working. Resolves to the link, or an error. */
  async renewInvitation(tenantId: Id, invitationId: Id): Promise<{ link: string } | { error: string }> {
    const remote = this.remote;
    if (remote) {
      try {
        const renewed = await remote.renewInvitation(tenantId, invitationId);
        await this.loadDetail(tenantId);
        return { link: invitationLink(renewed.token ?? '') };
      } catch (error) {
        return { error: toApiFailure(error).message };
      }
    }
    const invitation = this.directory.invitations().find((i) => i.id === invitationId);
    if (!invitation) return { error: 'Esa invitación ya no existe.' };
    const now = this.clock.now();
    const token = `demo-${newId('tok').slice(4)}`;
    this.directory.updateInvitation(invitationId, {
      demoToken: token,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
      createdAt: now.toISOString(),
    });
    this.audit(invitation.tenantId, 'invitation.sent', `Invitación reenviada a ${invitation.email}`);
    return { link: invitationLink(token) };
  }

  audit(tenantId: Id, action: AuditAction, detail: string): void {
    this.directory.record({
      id: newId('aud'),
      tenantId,
      actorUserId: this.session.user()?.id ?? 'system',
      action,
      detail,
      createdAt: this.clock.now().toISOString(),
    });
  }
}

function toTenantModel(row: ApiPlatformTenant): Tenant {
  const { channels: _channels, memberCount: _members, ...tenant } = row;
  return { ...tenant, currency: 'USD' };
}
