import { Component, computed, inject, signal } from '@angular/core';
import { ApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { CHANNEL_STATUS, QUALITY, ROLE } from '../../shared/api/labels';
import type { ChannelAccount, Id } from '../../shared/api/models';
import { formatShortDate } from '../../shared/format/date-time';
import { Avatar } from '../../shared/ui/avatar';
import { ColorPicker } from '../../shared/ui/color-picker';
import { Confirm } from '../../shared/ui/confirm';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { InvitationLinkDialog } from '../../shared/ui/invitation-link.dialog';
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
  imports: [Avatar, ColorPicker, Dialog, Icon, Pill, Skeleton, InviteDialog, InvitationLinkDialog, MemberAccessDialog],
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
  /** The team and its invitations arrived (the numbers come with the company). */
  protected readonly loaded = signal(false);

  protected readonly seats = computed(() => ({ used: this.team.seatsUsed(), total: PLAN_SEATS[this.session.tenant()?.plan ?? 'basic'] }));
  protected readonly active = computed(() => this.team.members().filter((m) => m.membership.status === 'active'));
  protected readonly disabled = computed(() => this.team.members().filter((m) => m.membership.status === 'disabled'));
  /** Bound once so the dialog keeps the same function between renders. */
  protected readonly saveAccess = (userId: Id, access: MemberAccess) => this.team.updateMember(userId, access);

  constructor() {
    void this.team.load().then((error) => {
      this.loaded.set(true);
      if (error) this.toaster.show(error, 'info');
    });
  }

  protected approvedTemplates(): number {
    return this.workspace.templates().filter((t) => t.status === 'approved').length;
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
    const done = await this.confirm.ask({
      title: `¿Desactivar a ${row.user.name}?`,
      message: 'No podrá entrar a la empresa. Sus conversaciones y su historial se conservan, y puedes reactivarla cuando quieras.',
      confirmLabel: 'Desactivar',
      danger: true,
      action: async () => failIf(await this.team.setActive(row.user.id, false)),
    });
    if (done) this.toaster.show(`${row.user.name} desactivada`);
  }

  protected async reactivate(row: TeamMemberRow): Promise<void> {
    const done = await this.confirm.ask({
      title: `¿Reactivar a ${row.user.name}?`,
      message: 'Vuelve a entrar a la empresa con el mismo rol y los mismos números que tenía.',
      confirmLabel: 'Reactivar',
      action: async () => failIf(await this.team.setActive(row.user.id, true)),
    });
    if (done) this.toaster.show(`${row.user.name} puede entrar de nuevo`);
  }

  protected async renew(invitation: PendingInvitation): Promise<void> {
    let link: string | null = null;
    const done = await this.confirm.ask({
      title: `¿Crear un enlace nuevo para ${invitation.name}?`,
      message: 'El enlace anterior deja de funcionar y el nuevo vale 72 horas.',
      confirmLabel: 'Crear enlace',
      action: async () => {
        const result = await this.team.renew(invitation.id);
        if ('error' in result) failIf(result.error);
        else link = result.link;
      },
    });
    if (done && link) this.link.set({ link, name: invitation.name });
  }

  protected async revoke(invitation: PendingInvitation): Promise<void> {
    const done = await this.confirm.ask({
      title: `¿Anular la invitación de ${invitation.name}?`,
      message: 'El enlace deja de funcionar. Si cambias de idea, invítala de nuevo.',
      confirmLabel: 'Anular invitación',
      danger: true,
      action: async () => failIf(await this.team.revoke(invitation.id)),
    });
    if (done) this.toaster.show('Invitación anulada');
  }

  protected editChannel(channel: ChannelAccount): void {
    this.channelForm.set({ channel, label: channel.label, color: channel.color });
  }

  protected setChannelLabel(event: Event): void {
    this.setChannelField('label', (event.target as HTMLInputElement).value);
  }

  protected setChannelField(key: 'label' | 'color', value: string): void {
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

}

/** The team's actions answer an error sentence or null; a confirmation's action needs a throw to stay open. */
function failIf(error: string | null): void {
  if (error) throw new ApiFailure(0, 'failed', error);
}
