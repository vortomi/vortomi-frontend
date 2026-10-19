import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Directory } from '../../core/directory';
import { CHANNEL_STATUS, QUALITY, ROLE, TENANT_PLAN, TENANT_STATUS } from '../../shared/api/labels';
import type { ChannelAccount, Invitation } from '../../shared/api/models';
import { formatShortDate } from '../../shared/format/date-time';
import { formatCount, formatUsdCents } from '../../shared/format/money';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { PlatformData } from './platform.data';

const TZ = 'America/Caracas';

/** One company seen from the console: data, numbers, team, usage and audit. No conversations. */
@Component({
  selector: 'app-tenant-detail-page',
  imports: [RouterLink, Avatar, Icon, Pill],
  templateUrl: './tenant-detail.page.html',
  styleUrls: ['./platform-pages.scss', './tenant-detail.page.scss'],
})
export class TenantDetailPage {
  protected readonly data = inject(PlatformData);
  private readonly directory = inject(Directory);
  private readonly toaster = inject(Toaster);

  /** From the route: /platform/tenants/:tenantId */
  readonly tenantId = input<string>();

  protected readonly labels = { status: TENANT_STATUS, plan: TENANT_PLAN, channel: CHANNEL_STATUS, quality: QUALITY, role: ROLE };
  protected readonly confirmingSuspend = signal(false);

  protected readonly row = computed(() => this.data.row(this.tenantId()));
  protected readonly members = computed(() => (this.row() ? this.data.members(this.row()!.tenant.id) : []));
  protected readonly invitations = computed(() => (this.row() ? this.data.pendingInvitations(this.row()!.tenant.id) : []));
  protected readonly audit = computed(() => (this.row() ? this.data.auditTrail(this.row()!.tenant.id) : []));

  protected readonly usage = computed(() => {
    const usage = this.row()?.usage;
    if (!usage) return null;
    return {
      total: formatCount(usage.totalMessages),
      service: formatCount(usage.service.sent),
      free: formatCount(usage.service.free),
      percent: Math.min(100, Math.round((usage.service.sent / usage.service.free) * 100)),
      templates: formatCount(usage.utility.sent + usage.marketing.sent),
      cost: formatUsdCents(usage.totalCents),
      over: usage.overFreeChannelIds.length > 0,
      charged: usage.totalCents > 0,
    };
  });

  protected date(iso: string | null): string {
    return iso ? formatShortDate(iso, TZ) : '—';
  }

  protected actorName(userId: string): string {
    return this.directory.userById().get(userId)?.name ?? 'Sistema';
  }

  protected suspend(): void {
    const id = this.row()?.tenant.id;
    if (!id) return;
    this.data.setStatus(id, 'suspended');
    this.confirmingSuspend.set(false);
    this.toaster.show('Empresa suspendida. Sus datos se conservan.', 'info');
  }

  protected reactivate(): void {
    const id = this.row()?.tenant.id;
    if (!id) return;
    this.data.setStatus(id, 'active');
    this.toaster.show('Empresa reactivada');
  }

  protected requestReconnect(channel: ChannelAccount): void {
    this.toaster.show(`Enviamos al cliente los pasos para volver a dar acceso al número ${channel.label}`, 'info');
  }

  protected resend(invitation: Invitation): void {
    this.data.resendInvitation(invitation.id);
    this.toaster.show(`Invitación reenviada a ${invitation.email}`);
  }

  protected invitationFor(email: string): Invitation | undefined {
    return this.invitations().find((i) => i.email === email);
  }
}
