import { Component, computed, inject, signal } from '@angular/core';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { CHANNEL_STATUS, QUALITY, ROLE } from '../../shared/api/labels';
import type { ChannelAccount, Id, Membership, TenantRole } from '../../shared/api/models';
import { Avatar } from '../../shared/ui/avatar';
import { ChannelBadge } from '../../shared/ui/channel-badge';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Switch } from '../../shared/ui/switch';
import { Toaster } from '../../shared/ui/toaster';
import { InviteDialog } from './invite.dialog';
import { TeamActions } from './team.actions';
import { PLAN_SEATS, seatsUsed } from './team.rules';

/** The company's WhatsApp numbers and who attends them (mockup web-6). */
@Component({
  selector: 'app-channels-team-page',
  imports: [Avatar, ChannelBadge, Icon, Pill, Switch, InviteDialog],
  templateUrl: './channels-team.page.html',
  styleUrl: './channels-team.page.scss',
})
export class ChannelsTeamPage {
  protected readonly workspace = inject(Workspace);
  protected readonly session = inject(Session);
  protected readonly team = inject(TeamActions);
  private readonly directory = inject(Directory);
  private readonly toaster = inject(Toaster);

  protected readonly labels = { channel: CHANNEL_STATUS, quality: QUALITY, role: ROLE };
  protected readonly inviting = signal(false);
  protected readonly editingChannel = signal<Id | null>(null);
  protected readonly confirmRemove = signal<Id | null>(null);

  protected readonly seats = computed(() => ({
    used: seatsUsed(this.team.memberships()),
    total: PLAN_SEATS[this.session.tenant()?.plan ?? 'basic'],
  }));

  protected readonly rows = computed(() => {
    const users = this.directory.userById();
    return this.team.memberships().flatMap((membership) => {
      const user = users.get(membership.userId);
      const invitation = this.team.pendingInvitations().find((i) => i.email === user?.email);
      return user ? [{ user, membership, invitation }] : [];
    });
  });

  protected approvedTemplates(): number {
    return this.workspace.templates().filter((t) => t.status === 'approved').length;
  }

  protected setRole(membership: Membership, event: Event): void {
    const role = (event.target as HTMLSelectElement).value as TenantRole;
    this.report(this.team.updateMember(membership.userId, { role }), 'Rol actualizado');
  }

  protected toggleChannel(membership: Membership, channelId: Id): void {
    const ids = membership.channelAccountIds.includes(channelId)
      ? membership.channelAccountIds.filter((id) => id !== channelId)
      : [...membership.channelAccountIds, channelId];
    this.report(this.team.updateMember(membership.userId, { channelAccountIds: ids }), null);
  }

  protected setSeeOthers(membership: Membership, value: boolean): void {
    this.report(this.team.updateMember(membership.userId, { canSeeOthers: value }), null);
  }

  protected remove(userId: Id): void {
    this.confirmRemove.set(null);
    this.report(this.team.removeMember(userId), 'Persona quitada del equipo');
  }

  protected resend(invitationId: Id): void {
    this.team.resendInvitation(invitationId);
    this.toaster.show('Invitación reenviada');
  }

  protected saveChannel(channel: ChannelAccount, label: string, color: string): void {
    if (!label.trim()) return;
    this.team.updateChannel(channel.id, { label: label.trim(), color });
    this.editingChannel.set(null);
    this.toaster.show('Número actualizado');
  }

  private report(error: string | null, success: string | null): void {
    if (error) this.toaster.show(error, 'info');
    else if (success) this.toaster.show(success);
  }
}
