import { Component, computed, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import type { ApiPlatformTeam, ApiStaffSession } from '../../shared/api/contract';
import { formatShortDate, formatTime } from '../../shared/format/date-time';
import { Avatar } from '../../shared/ui/avatar';
import { Confirm } from '../../shared/ui/confirm';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { InvitationLinkDialog } from '../../shared/ui/invitation-link.dialog';
import { Pill } from '../../shared/ui/pill';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { PlatformTeamRemote } from './platform-team.remote';
import { sampleTeam } from './platform-team.sample';
import {
  ACTIVITY_FILTERS,
  type ActivityEntry,
  type ActivityKind,
  HISTORY_FILTERS,
  type HistoryKind,
  type StaffMember,
  type TeamEvent,
  activityLook,
  expiryText,
  filterActivity,
  filterHistory,
  matchesPerson,
  staffSummary,
  staffWarnings,
  teamEventLook,
  teamEventText,
} from './staff.rules';
import { ago } from './usage-overview.rules';

type PendingInvitation = ApiPlatformTeam['invitations'][number];

const TZ = 'America/Caracas';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVERYONE = '__all__';

/**
 * «Staff» of the console (mockup web-28): who of our people enters it and how safely (code, last
 * access, open devices), the open invitations, the staff's history and «Actividad en la consola»,
 * what each one changed in which company. Nobody acts on themselves; nobody reads conversations.
 */
@Component({
  selector: 'app-platform-team-page',
  imports: [Avatar, Dialog, Icon, InvitationLinkDialog, Pill, SelectMenu, Skeleton],
  templateUrl: './platform-team.page.html',
  styleUrls: ['./platform-pages.scss', './platform-team.page.scss'],
  host: { '(document:click)': 'menuFor.set(null)' },
})
export class PlatformTeamPage {
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(PlatformTeamRemote) : null;
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  protected readonly preview = !this.remote;
  protected readonly now = signal(new Date());

  protected readonly team = signal<ApiPlatformTeam | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly inviting = signal(false);
  protected readonly draft = signal({ name: '', email: '' });
  protected readonly inviteError = signal<string | null>(null);
  /** The link just created or renewed: shown once. */
  protected readonly link = signal<{ link: string; name: string } | null>(null);
  /** The person whose ⋯ menu is open. */
  protected readonly menuFor = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly historyKind = signal<HistoryKind>('all');
  protected readonly activityKind = signal<ActivityKind>('all');
  protected readonly activityPerson = signal<string>(EVERYONE);

  protected readonly historyFilters = HISTORY_FILTERS;
  protected readonly activityFilters = ACTIVITY_FILTERS;
  protected readonly summary = computed(() => (this.team() ? staffSummary(this.team()!) : null));
  protected readonly warnings = computed(() => (this.team() ? staffWarnings(this.team()!, this.now()) : []));
  protected readonly people = computed(() => (this.team()?.admins ?? []).filter((a) => matchesPerson(a, this.query())));
  protected readonly history = computed(() => filterHistory(this.team()?.events ?? [], this.historyKind()));
  protected readonly activity = computed(() => {
    const person = this.activityPerson();
    return filterActivity(this.team()?.activity ?? [], this.activityKind(), person === EVERYONE ? null : person);
  });
  protected readonly personOptions = computed<MenuOption[]>(() => [
    { value: EVERYONE, label: 'Todo el staff' },
    ...(this.team()?.admins ?? []).map((a) => ({ value: a.userId, label: a.name })),
  ]);

  protected readonly look = teamEventLook;
  protected readonly activityLook = activityLook;
  protected readonly eventText = teamEventText;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.now.set(new Date());
    if (!this.remote) {
      this.team.set(sampleTeam(this.now()));
      return;
    }
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
    const days = Math.floor((this.now().getTime() - Date.parse(iso)) / 86_400_000);
    return days < 2 ? ago(iso, this.now()) : `${formatShortDate(iso, TZ)}, ${formatTime(iso, TZ)}`;
  }

  protected ago(iso: string | null): string {
    return iso ? ago(iso, this.now()) : '';
  }

  /** Used within the last hour: drawn as active. */
  protected isRecent(iso: string): boolean {
    return this.now().getTime() - Date.parse(iso) < 3_600_000;
  }

  protected expiry(invitation: PendingInvitation) {
    return expiryText(invitation.expiresAt, this.now());
  }

  /** «Ahora» for the session this page is open in; else how long ago. */
  protected lastAccess(admin: StaffMember): string {
    if (admin.isYou) return 'Ahora';
    return admin.lastSignInAt ? ago(admin.lastSignInAt, this.now()) : 'Nunca';
  }

  protected deviceOf(admin: StaffMember): string | null {
    const session = (this.team()?.sessions ?? []).find((s) => s.userId === admin.userId);
    return session ? `${session.browser} en ${session.system}` : null;
  }

  protected toggleMenu(admin: StaffMember, event: MouseEvent): void {
    event.stopPropagation();
    this.menuFor.update((open) => (open === admin.userId ? null : admin.userId));
  }

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected entryText(entry: ActivityEntry): string {
    return activityLook(entry.action).text;
  }

  protected trackEvent(_index: number, event: TeamEvent): string {
    return `${event.action}|${event.createdAt}`;
  }

  protected openInvite(): void {
    if (this.onlyWithServer()) return;
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
    if (!remote || this.onlyWithServer()) return;
    const done = await this.confirm.ask({
      title: `¿Crear un enlace nuevo para ${invitation.name}?`,
      message: 'El enlace anterior deja de funcionar y el nuevo vale 72 horas.',
      confirmLabel: 'Crear enlace',
      action: async () => this.link.set({ link: await remote.renew(invitation.id), name: invitation.name }),
    });
    if (done) await this.load();
  }

  protected async revoke(invitation: PendingInvitation): Promise<void> {
    await this.act({
      title: `¿Anular la invitación de ${invitation.name}?`,
      message: 'El enlace deja de funcionar. Puedes invitarle de nuevo cuando quieras.',
      confirmLabel: 'Anular',
      danger: true,
      run: (remote) => remote.revoke(invitation.id),
      toast: 'Invitación anulada',
    });
  }

  protected async resetCode(admin: StaffMember): Promise<void> {
    await this.act({
      title: `¿Reiniciar el código de seguridad de ${admin.name}?`,
      message: 'Para cuando perdió su teléfono. La próxima vez que entre a la consola escaneará un código nuevo con su app. Su acceso sigue.',
      confirmLabel: 'Reiniciar código',
      run: (remote) => remote.resetCode(admin.userId),
      toast: `Código de ${admin.name} reiniciado`,
    });
  }

  protected async endSessions(admin: StaffMember): Promise<void> {
    await this.act({
      title: `¿Cerrar todas las sesiones de ${admin.name}?`,
      message: 'Sale de todos sus dispositivos y tendrá que volver a entrar con su contraseña y su código. Lo que ya tenía abierto deja de renovarse y se cierra en máximo una hora; para sacarle en el acto, quita su acceso.',
      confirmLabel: 'Cerrar sesiones',
      run: (remote) => remote.endSessions(admin.userId),
      toast: `Sesiones de ${admin.name} cerradas`,
    });
  }

  protected async endSession(session: ApiStaffSession): Promise<void> {
    await this.act({
      title: `¿Cerrar la sesión de ${session.name} en ${session.browser} (${session.system})?`,
      message: 'Ese dispositivo tendrá que volver a entrar. Se cierra del todo en máximo una hora.',
      confirmLabel: 'Cerrar sesión',
      run: (remote) => remote.endSession(session.userId, session.id),
      toast: 'Sesión cerrada',
    });
  }

  protected async remove(admin: StaffMember): Promise<void> {
    await this.act({
      title: `¿Quitar el acceso de ${admin.name} a la consola?`,
      message: 'Deja de entrar a la consola desde este momento. Si además es parte de alguna empresa, esa cuenta sigue en la empresa.',
      confirmLabel: 'Quitar acceso',
      danger: true,
      run: (remote) => remote.remove(admin.userId),
      toast: `${admin.name} ya no entra a la consola`,
    });
  }

  /** A confirmed change, its toast and a reload. Preview mode only explains. */
  private async act(step: { title: string; message: string; confirmLabel: string; danger?: boolean; run: (remote: PlatformTeamRemote) => Promise<unknown>; toast: string }): Promise<void> {
    this.menuFor.set(null);
    const remote = this.remote;
    if (!remote || this.onlyWithServer()) return;
    const done = await this.confirm.ask({ title: step.title, message: step.message, confirmLabel: step.confirmLabel, danger: step.danger ?? false, action: () => step.run(remote) });
    if (done) {
      this.toaster.show(step.toast, step.danger ? 'info' : 'success');
      await this.load();
    }
  }

  private onlyWithServer(): boolean {
    if (this.remote) return false;
    this.toaster.show('El staff solo se cambia con el servidor real.', 'info');
    return true;
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
