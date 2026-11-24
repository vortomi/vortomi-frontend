import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { BusinessTypes } from '../../core/business-types';
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
import { ResetLinkDialog } from '../../shared/ui/reset-link.dialog';
import { RowMenu } from '../../shared/ui/row-menu';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { failIf } from './fail-if';
import { type MemberRow, PlatformData, type PlatformInvitation } from './platform.data';
import { TenantEditDialog } from './tenant-edit.dialog';
import { ChangeNumberDialog } from './change-number.dialog';
import { ActivityChart } from './activity-bars';
import { TenantInsightsData } from './tenant-insights.data';
import type { SetupStep, TenantDetailInsights } from './tenant-insights.remote';
import { percentChange, timeAgo } from './tenant-list.rules';
import { Clock } from '../../core/clock';
import type { ApiChannelApps } from '../../shared/api/contract';
import { appsCheckedText, sortedApps } from './channel-apps.rules';
import { TenantSubscriptionBox } from './subscriptions/tenant-subscription-box';

const TZ = 'America/Caracas';

/** «Puesta en marcha»: what each step means to the person reading the page. */
const SETUP_TEXT: Record<SetupStep, { title: string; detail?: (count: number) => string; missing: string }> = {
  number: { title: 'Número de WhatsApp conectado', missing: 'Sin un número funcionando no recibe mensajes' },
  business_info: { title: 'Información del negocio', missing: 'El agente no sabe qué vende ni cómo atiende' },
  products: { title: 'Productos cargados', detail: (n) => `${n} ${n === 1 ? 'producto' : 'productos'}`, missing: 'Todavía sin productos' },
  payment_methods: { title: 'Métodos de pago', detail: (n) => `${n} ${n === 1 ? 'método' : 'métodos'}`, missing: 'Sus clientes no saben cómo pagar' },
  template: { title: 'Plantilla aprobada por Meta', detail: (n) => `${n} ${n === 1 ? 'aprobada' : 'aprobadas'}`, missing: 'No puede escribir pasadas las 24 horas' },
  agent: { title: 'Agente de ventas encendido', missing: 'Responde solo su equipo' },
};

/** One company seen from the console: data, numbers, team, usage and audit. No conversations. */
@Component({
  selector: 'app-tenant-detail-page',
  imports: [RouterLink, Avatar, Icon, Pill, ResetLinkDialog, RowMenu, Skeleton, InvitationLinkDialog, TenantEditDialog, ChangeNumberDialog, ActivityChart, TenantSubscriptionBox],
  templateUrl: './tenant-detail.page.html',
  styleUrl: './tenant-detail.page.scss',
})
export class TenantDetailPage {
  protected readonly data = inject(PlatformData);
  private readonly directory = inject(Directory);
  private readonly businessTypes = inject(BusinessTypes);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly insightsData = inject(TenantInsightsData);
  private readonly clock = inject(Clock);

  /** From the route: /platform/tenants/:tenantId */
  readonly tenantId = input<string>();

  protected readonly labels = { status: TENANT_STATUS, plan: TENANT_PLAN, channel: CHANNEL_STATUS, quality: QUALITY, role: ROLE };
  protected readonly link = signal<{ link: string; name: string } | null>(null);
  /** A password link just given (mockup web-30): shown once. */
  protected readonly resetLink = signal<{ link: string; name: string } | null>(null);
  protected readonly busy = signal(false);
  /** «Editar datos» is open. */
  protected readonly editing = signal(false);
  /** The number whose «Cambiar número» is open. */
  protected readonly changing = signal<ChannelAccount | null>(null);
  /** The number being read again from Meta. */
  protected readonly refreshing = signal<string | null>(null);
  /** This company's people and invitations arrived (they come apart from the list). */
  protected readonly detailLoaded = signal(false);
  /** This company's figures (mockup web-25); null while loading or if they could not be read. */
  protected readonly insights = signal<TenantDetailInsights | null>(null);
  protected readonly insightsLoaded = signal(false);

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

  /** Who to call: the server's first administrator, or (preview) the first active admin of the team. */
  protected readonly owner = computed(() => {
    const fromServer = this.insights()?.owner;
    if (fromServer) return fromServer;
    const admin = this.members().find((m) => m.membership.role === 'admin' && m.membership.status === 'active');
    return admin ? { name: admin.user.name, email: admin.user.email } : null;
  });

  protected readonly change = computed(() => {
    const i = this.insights();
    return i ? percentChange(i.messages30d, i.previous30d) : null;
  });

  protected readonly setup = computed(() =>
    (this.insights()?.setup ?? []).map((item) => {
      const text = SETUP_TEXT[item.step];
      return { ...item, title: text.title, detail: item.done ? (item.count !== null && text.detail ? text.detail(item.count) : null) : text.missing };
    }),
  );
  protected readonly setupDone = computed(() => this.setup().filter((s) => s.done).length);

  protected readonly agentPercent = computed(() => {
    const agent = this.insights()?.agent;
    return agent && agent.cap > 0 ? Math.min(100, Math.round((agent.replies / agent.cap) * 100)) : 0;
  });

  /** Who receives each number's messages (mockup web-31). */
  protected readonly channelApps = computed(() => (this.row() ? this.data.channelApps(this.row()!.tenant.id) : new Map<string, ApiChannelApps>()));
  protected readonly appsChecked = (watched: ApiChannelApps) => appsCheckedText(watched, this.clock.now());
  protected readonly sortedApps = sortedApps;

  /** The figures of one number, by its id. */
  protected channelFacts(channelId: string) {
    return this.insights()?.channels.find((c) => c.channelId === channelId) ?? null;
  }

  protected ago(iso: string): string {
    return timeAgo(iso, this.clock.now());
  }

  protected count(value: number): string {
    return formatCount(value);
  }

  constructor() {
    // 'api' mode: the list (for the header) once, and this company's people every time it changes.
    effect(() => {
      const id = this.tenantId();
      if (!id) return;
      untracked(() => {
        this.detailLoaded.set(false);
        if (!this.data.ready()) void this.data.load().then(this.report);
        this.insights.set(null);
        this.insightsLoaded.set(false);
        void this.insightsData.detail(id).then((insights) => {
          this.insights.set(insights);
          this.insightsLoaded.set(true);
        });
        void this.data.loadDetail(id).then((error) => {
          this.detailLoaded.set(true);
          this.report(error);
        });
      });
    });
  }

  protected subtitle(tenant: Tenant): string {
    return [this.businessTypes.labelOf(tenant.businessType, tenant.businessTypeOther), tenant.city].filter(Boolean).join(' · ');
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
    const question = {
      title: `¿Suspender ${row.tenant.name}?`,
      message: 'Nadie de la empresa podrá entrar y el agente deja de responder a sus clientes hasta que la reactives. Sus datos, conversaciones y números se conservan.',
      confirmLabel: 'Suspender',
      danger: true,
    };
    await this.changeStatus('suspended', question, 'Empresa suspendida. Sus datos se conservan.');
  }

  protected async reactivate(): Promise<void> {
    const row = this.row();
    if (!row) return;
    const question = {
      title: `¿Reactivar ${row.tenant.name}?`,
      message: 'Su equipo vuelve a entrar al panel y a atender sus números, y el agente vuelve a responder si estaba encendido.',
      confirmLabel: 'Reactivar',
    };
    await this.changeStatus('active', question, 'Empresa reactivada');
  }

  /** Leaves the company out (status «cancelled»): nobody enters and nothing answers its customers; every row is kept. */
  protected async cancel(): Promise<void> {
    const row = this.row();
    if (!row) return;
    const question = {
      title: `¿Dar de baja a ${row.tenant.name}?`,
      message:
        'Nadie de la empresa podrá entrar, y ni el agente ni el mensaje de ausencia responderán a sus clientes. ' +
        'No se borra nada: conversaciones, pedidos y recibos se conservan, y se puede reactivar después.',
      confirmLabel: 'Dar de baja',
      danger: true,
    };
    await this.changeStatus('cancelled', question, 'Empresa dada de baja. Sus datos se conservan.');
  }

  /** Writes again the number as Meta shows it (a number typed by hand may be wrong). */
  protected async refreshNumber(channel: ChannelAccount): Promise<void> {
    const id = this.row()?.tenant.id;
    if (!id || this.refreshing()) return;
    this.refreshing.set(channel.id);
    const failure = await this.data.refreshNumber(id, channel.id);
    this.refreshing.set(null);
    this.toaster.show(failure ?? `Número ${channel.label} actualizado desde Meta`, failure ? 'info' : 'success');
  }

  protected onNumberChanged(kind: 'number' | 'token'): void {
    this.changing.set(null);
    this.toaster.show(kind === 'token' ? 'Clave nueva guardada. El número sigue igual.' : 'Número cambiado. Desde ahora llegan los mensajes del número nuevo.');
  }

  protected onSaved(): void {
    this.editing.set(false);
    this.toaster.show('Datos de la empresa actualizados');
  }

  protected requestReconnect(channel: ChannelAccount): void {
    this.toaster.show(`Pide al cliente que vuelva a darnos acceso al número ${channel.label} desde su Meta Business.`, 'info');
  }

  protected async renew(invitation: PlatformInvitation): Promise<void> {
    const id = this.row()?.tenant.id;
    if (!id) return;
    let link: string | null = null;
    const done = await this.confirm.ask({
      title: `¿Crear un enlace nuevo para ${invitation.name}?`,
      message: 'El enlace anterior deja de funcionar y el nuevo vale 72 horas.',
      confirmLabel: 'Crear enlace',
      action: async () => {
        const result = await this.data.renewInvitation(id, invitation.id);
        if ('error' in result) failIf(result.error);
        else link = result.link;
      },
    });
    if (done && link) this.link.set({ link, name: invitation.name });
  }

  /** Mockup web-30: their password stops working and they choose a new one with the link. */
  protected async resetPassword(member: MemberRow): Promise<void> {
    const id = this.row()?.tenant.id;
    if (!id) return;
    let given: { link: string; name: string } | null = null;
    const done = await this.confirm.ask({
      title: '¿Restablecer la contraseña de ' + member.user.name + '?',
      message: 'Su contraseña actual deja de servir y se cierran sus sesiones. Le das un enlace de un solo uso para que elija una nueva; nadie más la conoce.',
      confirmLabel: 'Crear enlace',
      action: async () => {
        const result = await this.data.resetPassword(id, member.user.id);
        if ('error' in result) failIf(result.error);
        else given = result;
      },
    });
    if (done && given) this.resetLink.set(given);
  }

  /** The company changes hands: the previous owner stays an admin. */
  protected async makeOwner(member: MemberRow): Promise<void> {
    const id = this.row()?.tenant.id;
    if (!id) return;
    const done = await this.confirm.ask({
      title: '¿Hacer dueño a ' + member.user.name + '?',
      message: 'Será quien da los enlaces de contraseña a su equipo. El dueño actual sigue como administrador.',
      confirmLabel: 'Hacer dueño',
      action: async () => failIf(await this.data.makeOwner(id, member.user.id)),
    });
    if (done) this.toaster.show(member.user.name + ' es ahora el dueño');
  }

  /** Asks first; the dialog shows the circle while the server answers and any error inside it. */
  private async changeStatus(
    status: 'active' | 'suspended' | 'cancelled',
    question: { title: string; message: string; confirmLabel: string; danger?: boolean },
    success: string,
  ): Promise<void> {
    const id = this.row()?.tenant.id;
    if (!id || this.busy()) return;
    this.busy.set(true);
    const done = await this.confirm.ask({ ...question, action: async () => failIf(await this.data.setStatus(id, status)) });
    this.busy.set(false);
    if (done) this.toaster.show(success, status === 'active' ? 'success' : 'info');
  }

  private readonly report = (error: string | null) => {
    if (error) this.toaster.show(error, 'info');
  };
}
