import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Auth } from '../../core/auth';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import { Theme, type ThemeMode } from '../../core/theme';
import type { ApiMyProfile } from '../../shared/api/contract';
import { formatShortDate, formatTime } from '../../shared/format/date-time';
import { Avatar } from '../../shared/ui/avatar';
import { Confirm } from '../../shared/ui/confirm';
import { FieldError } from '../../shared/ui/field-error';
import { Icon, type IconName } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { ago } from '../platform/usage-overview.rules';
import { AccountRemote } from './account.remote';
import { ChangePasswordDialog } from './change-password.dialog';
import { ChangePhoneDialog } from './change-phone.dialog';
import { myActivityLook, roleBadge, roleText, sessionsLine } from './profile.rules';
import { sampleProfile } from './profile.sample';

const TZ = 'America/Caracas';
type Session_ = ApiMyProfile['sessions'][number];

/**
 * «Mi perfil» (mockup web-29), for our staff and for company people alike: who they are and since
 * when, their name, the look of the panel, their security (password, code, devices), their open
 * sessions and, for the staff, their own console activity; for someone in several companies, those.
 */
@Component({
  selector: 'app-profile-page',
  imports: [Avatar, ChangePasswordDialog, ChangePhoneDialog, FieldError, FormField, Icon, Pill, Skeleton],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  protected readonly session = inject(Session);
  private readonly directory = inject(Directory);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(Confirm);
  protected readonly theme = inject(Theme);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(AccountRemote) : null;
  protected readonly now = signal(new Date());

  protected readonly themeModes: { mode: ThemeMode; label: string; icon: IconName }[] = [
    { mode: 'system', label: 'Sistema', icon: 'monitor' },
    { mode: 'light', label: 'Claro', icon: 'sun' },
    { mode: 'dark', label: 'Oscuro', icon: 'moon' },
  ];

  protected readonly profile = signal<ApiMyProfile | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly changingPassword = signal(false);
  protected readonly changingPhone = signal(false);
  protected readonly busy = signal(false);

  private readonly nameModel = signal({ name: '' });
  protected readonly nameForm = form(this.nameModel, (path) => {
    required(path.name, { message: 'Escribe tu nombre.' });
  });

  protected readonly badge = computed(() => (this.profile() ? roleBadge(this.profile()!, this.session.tenant()?.id ?? null) : ''));
  protected readonly others = computed(() => (this.profile()?.sessions ?? []).filter((s) => !s.current).length);
  protected readonly sessionsText = computed(() => sessionsLine(this.profile()?.sessions ?? []));
  protected readonly look = myActivityLook;
  protected readonly roleText = roleText;
  protected readonly inConsole = computed(() => this.router.url.startsWith('/platform'));

  constructor() {
    effect(() => {
      const name = this.session.user()?.name ?? '';
      untracked(() => this.nameModel.set({ name }));
    });
    void this.load();
  }

  protected async load(): Promise<void> {
    this.now.set(new Date());
    const user = this.session.user();
    if (!this.remote) {
      if (user) this.profile.set(sampleProfile(user, this.session.isSuperAdmin(), this.sampleCompanies(), this.now()));
      return;
    }
    this.loadError.set(null);
    try {
      this.profile.set(await this.remote.profile());
    } catch (error) {
      this.loadError.set(toApiFailure(error).message);
    }
  }

  protected date(iso: string | null): string {
    return iso ? formatShortDate(iso, TZ) : '—';
  }

  /** «Hoy, 8:02 am», or the date for older ones. */
  protected stamp(iso: string | null): string {
    if (!iso) return 'Nunca';
    const today = formatShortDate(this.now().toISOString(), TZ) === formatShortDate(iso, TZ);
    return today ? `Hoy, ${formatTime(iso, TZ)}` : `${formatShortDate(iso, TZ)}, ${formatTime(iso, TZ)}`;
  }

  protected ago(iso: string): string {
    return ago(iso, this.now());
  }

  protected isRecent(iso: string): boolean {
    return this.now().getTime() - Date.parse(iso) < 3_600_000;
  }

  protected async saveName(event: Event): Promise<void> {
    event.preventDefault();
    const user = this.session.user();
    if (!user) return;
    await submit(this.nameForm, async () => {
      const name = this.nameModel().name.trim();
      try {
        if (this.remote) await this.remote.rename(name);
        // The sidebar and everything else read the name from here.
        this.directory.updateUser(user.id, { name });
        this.profile.update((p) => (p ? { ...p, name } : p));
        this.toaster.show('Nombre actualizado');
      } catch (error) {
        this.toaster.show(toApiFailure(error).message, 'info');
      }
      return undefined;
    });
  }

  protected openPassword(): void {
    if (this.onlyWithServer()) return;
    this.changingPassword.set(true);
  }

  protected async passwordClosed(changed: boolean): Promise<void> {
    this.changingPassword.set(false);
    if (!changed) return;
    this.toaster.show('Contraseña actualizada. Cerramos tus otras sesiones.');
    await this.load();
  }

  protected openPhone(): void {
    if (this.onlyWithServer()) return;
    this.changingPhone.set(true);
  }

  protected async phoneClosed(changed: boolean): Promise<void> {
    this.changingPhone.set(false);
    if (changed) {
      this.toaster.show('Código de seguridad cambiado al teléfono nuevo');
      await this.load();
    }
  }

  protected async endSession(session: Session_): Promise<void> {
    const remote = this.remote;
    if (!remote || this.onlyWithServer()) return;
    const done = await this.confirm.ask({
      title: `¿Cerrar la sesión en ${session.browser} (${session.system})?`,
      message: 'Ese dispositivo tendrá que volver a entrar. Se cierra del todo en máximo una hora.',
      confirmLabel: 'Cerrar sesión',
      action: () => remote.endSession(session.id),
    });
    if (done) {
      this.toaster.show('Sesión cerrada');
      await this.load();
    }
  }

  protected async endOthers(): Promise<void> {
    const remote = this.remote;
    if (!remote || this.onlyWithServer()) return;
    const done = await this.confirm.ask({
      title: '¿Cerrar tus sesiones en los demás dispositivos?',
      message: 'Solo sigues dentro en este. Los demás tendrán que volver a entrar; se cierran del todo en máximo una hora.',
      confirmLabel: 'Cerrar las demás',
      action: () => remote.endOtherSessions(),
    });
    if (done) {
      this.toaster.show('Cerramos tus otras sesiones');
      await this.load();
    }
  }

  protected goTo(tenantId: string): void {
    if (this.session.switchTenant(tenantId)) void this.router.navigateByUrl('/inbox');
  }

  protected signOut(): void {
    this.auth.signOut();
    void this.router.navigateByUrl('/login');
  }

  /** Preview mode: the person's companies from the sample tables. */
  private sampleCompanies(): ApiMyProfile['companies'] {
    const userId = this.session.user()?.id;
    return this.directory
      .memberships()
      .filter((m) => m.userId === userId && m.status === 'active')
      .map((m) => ({ tenantId: m.tenantId, name: this.directory.tenantById().get(m.tenantId)?.name ?? '', role: m.role, since: '2026-09-03T12:00:00Z' }));
  }

  private onlyWithServer(): boolean {
    if (this.remote) return false;
    this.toaster.show('Esto solo funciona con el servidor real.', 'info');
    return true;
  }
}
