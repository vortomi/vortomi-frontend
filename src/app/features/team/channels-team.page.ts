import { Component, computed, inject, signal } from '@angular/core';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { CHANNEL_STATUS, QUALITY, ROLE } from '../../shared/api/labels';
import type { ChannelAccount, Id } from '../../shared/api/models';
import { formatShortDate } from '../../shared/format/date-time';
import { Avatar } from '../../shared/ui/avatar';
import { ChannelBadge } from '../../shared/ui/channel-badge';
import { Confirm } from '../../shared/ui/confirm';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { InvitationLinkDialog } from './invitation-link.dialog';
import { InviteDialog } from './invite.dialog';
import { MemberAccessDialog } from './member-access.dialog';
import type { MemberAccess } from './team-remote';
import { type PendingInvitation, TeamActions, type TeamMemberRow } from './team.actions';
import { PLAN_SEATS } from './team.rules';

/**
 * The company's WhatsApp numbers and who attends them (mockup web-6). Everything shows as
 * text; changes happen in dialogs with their own «Guardar», and risky ones ask first.
 */
@Component({
  selector: 'app-channels-team-page',
  imports: [Avatar, ChannelBadge, Dialog, Icon, Pill, InviteDialog, InvitationLinkDialog, MemberAccessDialog],
  templateUrl: './channels-team.page.html',
  styleUrl: './channels-team.page.scss',
})
export class ChannelsTeamPage {
  protected readonly workspace = inject(Workspace);
  protected readonly session = inject(Session);
  protected readonly team = inject(TeamActions);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly labels = { channel: CHANNEL_STATUS, quality: QUALITY, role: ROLE };
  protected readonly inviting = signal(false);
  protected readonly editingMember = signal<TeamMemberRow | null>(null);
  protected readonly link = signal<{ link: string; name: string } | null>(null);
  protected readonly channelForm = signal<{ channel: ChannelAccount; label: string; color: string } | null>(null);
  protected readonly savingChannel = signal(false);

  protected readonly seats = computed(() => ({ used: this.team.seatsUsed(), total: PLAN_SEATS[this.session.tenant()?.plan ?? 'basic'] }));
  protected readonly active = computed(() => this.team.members().filter((m) => m.membership.status === 'active'));
  protected readonly disabled = computed(() => this.team.members().filter((m) => m.membership.status === 'disabled'));
  /** Bound once so the dialog keeps the same function between renders. */
  protected readonly saveAccess = (userId: Id, access: MemberAccess) => this.team.updateMember(userId, access);

  constructor() {
    void this.team.load().then((error) => error && this.toaster.show(error, 'info'));
  }

  protected approvedTemplates(): number {
    return this.workspace.templates().filter((t) => t.status === 'approved').length;
  }

  protected channelsOf(row: TeamMemberRow): ChannelAccount[] {
    if (row.membership.role === 'admin') return this.workspace.channels();
    return this.workspace.channels().filter((c) => row.membership.channelAccountIds.includes(c.id));
  }

  protected expires(invitation: PendingInvitation): string {
    const expired = new Date(invitation.expiresAt).getTime() < Date.now();
    return expired ? 'Vencida' : `Vence el ${formatShortDate(invitation.expiresAt, this.session.timezone())}`;
  }

  protected accessSaved(): void {
    const name = this.editingMember()?.user.name ?? '';
    this.editingMember.set(null);
    this.toaster.show(`Acceso de ${name} guardado`);
  }

  protected async disable(row: TeamMemberRow): Promise<void> {
    const yes = await this.confirm.ask({
      title: `¿Desactivar a ${row.user.name}?`,
      message: 'No podrá entrar a la empresa. Sus conversaciones y su historial se conservan, y puedes reactivarla cuando quieras.',
      confirmLabel: 'Desactivar',
      danger: true,
    });
    if (yes) this.report(await this.team.setActive(row.user.id, false), `${row.user.name} desactivada`);
  }

  protected async reactivate(row: TeamMemberRow): Promise<void> {
    this.report(await this.team.setActive(row.user.id, true), `${row.user.name} puede entrar de nuevo`);
  }

  protected async renew(invitation: PendingInvitation): Promise<void> {
    const result = await this.team.renew(invitation.id);
    if ('error' in result) return this.toaster.show(result.error, 'info');
    this.link.set({ link: result.link, name: invitation.name });
  }

  protected async revoke(invitation: PendingInvitation): Promise<void> {
    const yes = await this.confirm.ask({
      title: `¿Anular la invitación de ${invitation.name}?`,
      message: 'El enlace deja de funcionar. Si cambias de idea, invítala de nuevo.',
      confirmLabel: 'Anular invitación',
      danger: true,
    });
    if (yes) this.report(await this.team.revoke(invitation.id), 'Invitación anulada');
  }

  protected editChannel(channel: ChannelAccount): void {
    this.channelForm.set({ channel, label: channel.label, color: channel.color });
  }

  protected setChannelField(key: 'label' | 'color', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.channelForm.update((f) => (f ? { ...f, [key]: value } : f));
  }

  protected async saveChannel(): Promise<void> {
    const f = this.channelForm();
    if (!f || !f.label.trim() || this.savingChannel()) return;
    this.savingChannel.set(true);
    const error = await this.team.updateChannel(f.channel.id, { label: f.label.trim(), color: f.color });
    this.savingChannel.set(false);
    if (error) return this.toaster.show(error, 'info');
    this.channelForm.set(null);
    this.toaster.show('Número actualizado');
  }

  private report(error: string | null, success: string): void {
    if (error) this.toaster.show(error, 'info');
    else this.toaster.show(success);
  }
}
