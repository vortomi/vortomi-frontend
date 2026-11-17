import { Component, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import type { ApiPlatformTeam } from '../../shared/api/contract';
import { formatShortDate, formatTime } from '../../shared/format/date-time';
import { Avatar } from '../../shared/ui/avatar';
import { Confirm } from '../../shared/ui/confirm';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { InvitationLinkDialog } from '../../shared/ui/invitation-link.dialog';
import { Pill } from '../../shared/ui/pill';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { PlatformTeamRemote } from './platform-team.remote';

type Admin = ApiPlatformTeam['admins'][number];
type PendingInvitation = ApiPlatformTeam['invitations'][number];
type TeamEvent = ApiPlatformTeam['events'][number];

const TZ = 'America/Caracas';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACTION_TEXT: Record<TeamEvent['action'], string> = {
  'admin.invited': 'invitó a',
  'admin.invitation_renewed': 'creó un enlace nuevo para',
  'admin.invitation_revoked': 'anuló la invitación de',
  'admin.joined': 'entró al equipo',
  'admin.code_reset': 'reinició el código de',
  'admin.removed': 'quitó el acceso a',
};

/**
 * Who enters our console (mockup web-22): invite another admin, reset a lost code, remove someone.
 * Each person has their own authenticator code on their own phone; nobody acts on themselves here.
 */
@Component({
  selector: 'app-platform-team-page',
  imports: [Avatar, Dialog, Icon, InvitationLinkDialog, Pill, Skeleton],
  templateUrl: './platform-team.page.html',
  styleUrls: ['./platform-pages.scss'],
  styles: `
    .person { display: flex; align-items: center; gap: 10px; }
    .person b { display: block; font-size: 14px; }
    .person small { font-size: 12.5px; color: var(--color-text-muted); }
    .actions { text-align: right; white-space: nowrap; }
    .actions .btn + .btn { margin-left: 6px; }
    .muted { color: var(--color-text-muted); font-size: 13px; }
    .box { padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; }
    .box h2 { font-size: 16px; font-weight: 600; }
    .history { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; font-size: 13.5px; }
    .history li { display: flex; gap: 12px; }
    .history li .muted { min-width: 120px; }
    .form-alert.info { margin: 14px 0; }
    .lead { font-size: 14px; line-height: 1.5; }
  `,
})
export class PlatformTeamPage {
  protected readonly remote = inject(API_CONFIG).mode === 'api' ? inject(PlatformTeamRemote) : null;
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly team = signal<ApiPlatformTeam | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly inviting = signal(false);
  protected readonly draft = signal({ name: '', email: '' });
  protected readonly inviteError = signal<string | null>(null);
  /** The link just created or renewed: shown once. */
  protected readonly link = signal<{ link: string; name: string } | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    if (!this.remote) return;
    this.loadError.set(null);
    try {
      this.team.set(await this.remote.overview());
    } catch (error) {
      this.loadError.set(toApiFailure(error).message);
    }
  }

  protected date(iso: string): string {
    return formatShortDate(iso, TZ);
  }

  protected when(iso: string): string {
    return `${formatShortDate(iso, TZ)}, ${formatTime(iso, TZ)}`;
  }

  protected actionText(event: TeamEvent): string {
    return event.action === 'admin.joined' ? ACTION_TEXT[event.action] : `${ACTION_TEXT[event.action]} ${event.subjectEmail}`;
  }

  protected openInvite(): void {
    this.draft.set({ name: '', email: '' });
    this.inviteError.set(null);
    this.inviting.set(true);
  }

  protected setDraft(field: 'name' | 'email', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected async invite(): Promise<void> {
    const remote = this.remote;
    const name = this.draft().name.trim();
    const email = this.draft().email.trim().toLowerCase();
    if (!remote || this.busy()) return;
    if (!name) return this.inviteError.set('Escribe su nombre.');
    if (!EMAIL.test(email)) return this.inviteError.set('Ese correo no parece válido.');
    await this.run(async () => {
      const link = await remote.invite(name, email);
      this.inviting.set(false);
      this.link.set({ link, name });
    }, (message) => this.inviteError.set(message));
  }

  protected async renew(invitation: PendingInvitation): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    const done = await this.confirm.ask({
      title: `¿Crear un enlace nuevo para ${invitation.name}?`,
      message: 'El enlace anterior deja de funcionar y el nuevo vale 72 horas.',
      confirmLabel: 'Crear enlace',
      action: async () => this.link.set({ link: await remote.renew(invitation.id), name: invitation.name }),
    });
    if (done) await this.load();
  }

  protected async revoke(invitation: PendingInvitation): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    const done = await this.confirm.ask({
      title: `¿Anular la invitación de ${invitation.name}?`,
      message: 'El enlace deja de funcionar. Puedes invitarle de nuevo cuando quieras.',
      confirmLabel: 'Anular',
      danger: true,
      action: () => remote.revoke(invitation.id),
    });
    if (done) {
      this.toaster.show('Invitación anulada', 'info');
      await this.load();
    }
  }

  protected async resetCode(admin: Admin): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    const done = await this.confirm.ask({
      title: `¿Reiniciar el código de ${admin.name}?`,
      message: 'Para cuando perdió su teléfono. La próxima vez que entre a la consola escaneará un código nuevo con su app. Su acceso sigue.',
      confirmLabel: 'Reiniciar código',
      action: () => remote.resetCode(admin.userId),
    });
    if (done) {
      this.toaster.show(`Código de ${admin.name} reiniciado`);
      await this.load();
    }
  }

  protected async remove(admin: Admin): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    const done = await this.confirm.ask({
      title: `¿Quitar el acceso de ${admin.name} a la consola?`,
      message: 'Deja de entrar a la consola desde este momento. Si además es parte de alguna empresa, esa cuenta sigue en la empresa.',
      confirmLabel: 'Quitar acceso',
      danger: true,
      action: () => remote.remove(admin.userId),
    });
    if (done) {
      this.toaster.show(`${admin.name} ya no entra a la consola`, 'info');
      await this.load();
    }
  }

  /** One action at a time; its failure is said where it happened. */
  private async run(work: () => Promise<void>, fail: (message: string) => void): Promise<void> {
    this.busy.set(true);
    try {
      await work();
      await this.load();
    } catch (error) {
      fail(toApiFailure(error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
