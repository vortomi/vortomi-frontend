import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Directory } from '../../core/directory';
import { CHANNEL_STATUS, QUALITY, ROLE, TENANT_PLAN, TENANT_STATUS } from '../../shared/api/labels';
import type { ChannelAccount, Tenant } from '../../shared/api/models';
import { formatShortDate } from '../../shared/format/date-time';
import { formatCount, formatUsdCents } from '../../shared/format/money';
import { Avatar } from '../../shared/ui/avatar';
import { Confirm } from '../../shared/ui/confirm';
import { Icon } from '../../shared/ui/icon';
import { InvitationLinkDialog } from '../../shared/ui/invitation-link.dialog';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { PlatformData, type PlatformInvitation } from './platform.data';

const TZ = 'America/Caracas';

/** One company seen from the console: data, numbers, team, usage and audit. No conversations. */
@Component({
  selector: 'app-tenant-detail-page',
  imports: [RouterLink, Avatar, Icon, Pill, InvitationLinkDialog],
  templateUrl: './tenant-detail.page.html',
  styleUrls: ['./platform-pages.scss', './tenant-detail.page.scss'],
})
export class TenantDetailPage {
  protected readonly data = inject(PlatformData);
  private readonly directory = inject(Directory);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  /** From the route: /platform/tenants/:tenantId */
  readonly tenantId = input<string>();

  protected readonly labels = { status: TENANT_STATUS, plan: TENANT_PLAN, channel: CHANNEL_STATUS, quality: QUALITY, role: ROLE };
  protected readonly link = signal<{ link: string; name: string } | null>(null);
  protected readonly busy = signal(false);

  protected readonly row = computed(() => this.data.row(this.tenantId()));
  protected readonly members = computed(() => (this.row() ? this.data.members(this.row()!.tenant.id) : []));
  protected readonly invitations = computed(() => (this.row() ? this.data.pendingInvitations(this.row()!.tenant.id) : []));
  protected readonly audit = computed(() => (this.row() ? this.data.auditTrail(this.row()!.tenant.id) : []));
  protected readonly month = new Intl.DateTimeFormat('es-VE', { month: 'long', timeZone: TZ }).format(new Date());

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

  constructor() {
    // 'api' mode: the list (for the header) once, and this company's people every time it changes.
    effect(() => {
      const id = this.tenantId();
      if (!id) return;
      untracked(() => {
        if (!this.data.ready()) void this.data.load().then(this.report);
        void this.data.loadDetail(id).then(this.report);
      });
    });
  }

  protected subtitle(tenant: Tenant): string {
    return [tenant.industry, tenant.city].filter(Boolean).join(' · ');
  }

  protected date(iso: string | null): string {
    return iso ? formatShortDate(iso, TZ) : '—';
  }

  protected actorName(userId: string): string {
    return this.directory.userById().get(userId)?.name ?? 'Sistema';
  }

  protected async suspend(): Promise<void> {
    const row = this.row();
    if (!row) return;
    const yes = await this.confirm.ask({
      title: `¿Suspender ${row.tenant.name}?`,
      message: 'Nadie de la empresa podrá entrar hasta que la reactives. Sus datos, conversaciones y números se conservan.',
      confirmLabel: 'Suspender',
      danger: true,
    });
    if (yes) await this.changeStatus('suspended', 'Empresa suspendida. Sus datos se conservan.');
  }

  protected async reactivate(): Promise<void> {
    await this.changeStatus('active', 'Empresa reactivada');
  }

  protected requestReconnect(channel: ChannelAccount): void {
    this.toaster.show(`Pide al cliente que vuelva a darnos acceso al número ${channel.label} desde su Meta Business.`, 'info');
  }

  protected async renew(invitation: PlatformInvitation): Promise<void> {
    const id = this.row()?.tenant.id;
    if (!id) return;
    const result = await this.data.renewInvitation(id, invitation.id);
    if ('error' in result) return this.toaster.show(result.error, 'info');
    this.link.set({ link: result.link, name: invitation.name });
  }

  private async changeStatus(status: 'active' | 'suspended', success: string): Promise<void> {
    const id = this.row()?.tenant.id;
    if (!id || this.busy()) return;
    this.busy.set(true);
    const error = await this.data.setStatus(id, status);
    this.busy.set(false);
    if (error) this.toaster.show(error, 'info');
    else this.toaster.show(success, status === 'suspended' ? 'info' : 'success');
  }

  private readonly report = (error: string | null) => {
    if (error) this.toaster.show(error, 'info');
  };
}
