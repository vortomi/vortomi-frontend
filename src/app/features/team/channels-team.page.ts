import { Component, inject, signal } from '@angular/core';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { CHANNEL_STATUS, QUALITY } from '../../shared/api/labels';
import type { ChannelAccount } from '../../shared/api/models';
import { formatShortDate } from '../../shared/format/date-time';
import { ColorPicker } from '../../shared/ui/color-picker';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { ChannelSignupActions, metaBillingUrl } from './channel-signup.actions';
import { ConnectWhatsappCard } from './connect-whatsapp.card';
import { TeamActions } from './team.actions';
import { TeamSection } from './team-section';

/**
 * The company's WhatsApp numbers and who attends them (mockup web-6). Everything shows as
 * text; changes happen in dialogs with their own «Guardar», and risky ones ask first.
 */
@Component({
  selector: 'app-channels-team-page',
  imports: [ColorPicker, ConnectWhatsappCard, Dialog, Icon, Pill, TeamSection],
  templateUrl: './channels-team.page.html',
  styleUrls: ['./team-titles.scss', './channels-team.page.scss'],
})
export class ChannelsTeamPage {
  protected readonly workspace = inject(Workspace);
  protected readonly session = inject(Session);
  protected readonly team = inject(TeamActions);
  private readonly toaster = inject(Toaster);
  protected readonly signup = inject(ChannelSignupActions);

  protected readonly labels = { channel: CHANNEL_STATUS, quality: QUALITY };
  protected readonly channelForm = signal<{ channel: ChannelAccount; label: string; color: string } | null>(null);
  protected readonly savingChannel = signal(false);

  protected billingUrl(channel: ChannelAccount): string {
    return metaBillingUrl(channel.wabaId);
  }

  /** A connection made with «Conectar WhatsApp» lasts 60 days: warned two weeks ahead, and after. */
  protected expiry(channel: ChannelAccount): { text: string; soon: boolean } | null {
    if (!channel.accessExpiresAt) return null;
    const left = new Date(channel.accessExpiresAt).getTime() - Date.now();
    const day = formatShortDate(channel.accessExpiresAt, this.session.timezone());
    if (left <= 0) return { text: 'La conexión con Meta venció: el bot no puede responder. Reconéctala.', soon: true };
    if (left <= EXPIRY_NOTICE_MS) return { text: `La conexión con Meta vence el ${day}. Reconéctala antes para que el bot siga respondiendo.`, soon: true };
    return { text: `Conexión con Meta hasta el ${day}`, soon: false };
  }

  /** Same window as connecting: Meta gives a new connection for the same number, which keeps its place. */
  protected reconnect(): void {
    void this.signup.connect(this.session.tenant()?.id ?? '').then((outcome) => {
      if (outcome.kind === 'connected') this.toaster.show(`Conexión de ${outcome.result.displayNumber} renovada`);
      else if (outcome.kind === 'error') this.toaster.show(outcome.message, 'info');
    });
  }

  protected approvedTemplates(): number {
    return this.workspace.templates().filter((t) => t.status === 'approved').length;
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

const EXPIRY_NOTICE_MS = 14 * 24 * 3_600_000;

