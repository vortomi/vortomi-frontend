import { Injectable, computed, inject } from '@angular/core';
import { Clock } from '../../core/clock';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import type {
  AuditAction,
  ChannelAccount,
  ChannelStatus,
  Id,
  Membership,
  QualityRating,
  Tenant,
  TenantStatus,
  User,
} from '../../shared/api/models';
import { newId } from '../../shared/api/mock-db';
import { type MetaSpend, estimateSpend } from '../../shared/billing/meta-pricing';
import { platformAlerts } from './platform-alerts';

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

const STATUS_RANK: Record<ChannelStatus, number> = { connected: 0, restricted: 1, disconnected: 2 };
const QUALITY_RANK: Record<QualityRating, number> = { high: 0, medium: 1, low: 2 };
const INVITATION_TTL_MS = 72 * 3_600_000;

const worst = <T extends string>(values: T[], rank: Record<T, number>): T | null =>
  values.reduce<T | null>((acc, v) => (acc === null || rank[v] > rank[acc] ? v : acc), null);

/** Read model and actions of the platform console. Never touches conversations. */
@Injectable({ providedIn: 'root' })
export class PlatformData {
  private readonly directory = inject(Directory);
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);

  readonly ready = this.directory.ready;

  readonly rows = computed<TenantRow[]>(() => {
    const channels = this.directory.channels();
    const memberships = this.directory.memberships();
    const usage = this.directory.usage();
    return this.directory.tenants().map((tenant) => {
      const own = channels.filter((c) => c.tenantId === tenant.id);
      const ownUsage = usage.filter((u) => u.tenantId === tenant.id);
      return {
        tenant,
        channels: own,
        memberCount: memberships.filter((m) => m.tenantId === tenant.id && m.status === 'active').length,
        usage: ownUsage.length ? estimateSpend(ownUsage) : null,
        channelStatus: worst(own.map((c) => c.status), STATUS_RANK),
        worstQuality: worst(own.map((c) => c.qualityRating), QUALITY_RANK),
      };
    });
  });

  readonly alerts = computed(() => platformAlerts(this.directory.tenants(), this.directory.channels(), this.clock.now()));

  readonly kpis = computed(() => ({
    activeTenants: this.directory.tenants().filter((t) => t.status === 'active').length,
    connectedNumbers: this.directory.channels().filter((c) => c.status === 'connected').length,
    monthMessages: this.directory.usage().reduce((sum, u) => sum + u.totalMessages, 0),
    openAlerts: this.alerts().length,
  }));

  row(tenantId: Id | undefined): TenantRow | null {
    return this.rows().find((r) => r.tenant.id === tenantId) ?? null;
  }

  members(tenantId: Id): MemberRow[] {
    const users = this.directory.userById();
    return this.directory
      .memberships()
      .filter((m) => m.tenantId === tenantId)
      .flatMap((membership) => {
        const user = users.get(membership.userId);
        return user ? [{ user, membership }] : [];
      });
  }

  pendingInvitations(tenantId: Id) {
    return this.directory.invitations().filter((i) => i.tenantId === tenantId && !i.acceptedAt);
  }

  auditTrail(tenantId: Id) {
    return this.directory
      .audit()
      .filter((a) => a.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  setStatus(tenantId: Id, status: Extract<TenantStatus, 'active' | 'suspended'>): void {
    const tenant = this.directory.tenantById().get(tenantId);
    if (!tenant || tenant.status === status) return;
    const reactivating = tenant.status === 'suspended' && status === 'active';
    this.directory.updateTenant(tenantId, { status });
    this.audit(
      tenantId,
      status === 'suspended' ? 'tenant.suspended' : reactivating ? 'tenant.reactivated' : 'tenant.activated',
      status === 'suspended' ? 'Acceso suspendido; los datos se conservan' : 'Acceso restablecido',
    );
  }

  /** A fresh link with a new 72 h window; the old one stops working. */
  resendInvitation(invitationId: Id): void {
    const invitation = this.directory.invitations().find((i) => i.id === invitationId);
    if (!invitation) return;
    const now = this.clock.now();
    this.directory.updateInvitation(invitationId, {
      demoToken: `demo-${newId('tok').slice(4)}`,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
      createdAt: now.toISOString(),
    });
    this.audit(invitation.tenantId, 'invitation.sent', `Invitación reenviada a ${invitation.email}`);
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
