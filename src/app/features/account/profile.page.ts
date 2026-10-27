import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormField, apply, form, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import { type NewPassword, emptyNewPassword, newPasswordSchema } from '../../shared/security/new-password.schema';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { PasswordMeter } from '../../shared/ui/password-meter';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';

interface PasswordChange {
  current: string;
  next: NewPassword;
}

@Component({
  selector: 'app-profile-page',
  imports: [FormField, FieldError, Icon, PasswordMeter, Pill],
  templateUrl: './profile.page.html',
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .card { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
    h2 { font-size: 15.5px; }
    .muted-row { display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; }
    form { display: flex; flex-direction: column; gap: 12px; }
    .actions { display: flex; justify-content: flex-end; }
  `,
})
export class ProfilePage {
  protected readonly session = inject(Session);
  private readonly directory = inject(Directory);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  private readonly nameModel = signal({ name: '' });
  protected readonly nameForm = form(this.nameModel, (path) => {
    required(path.name, { message: 'Escribe tu nombre.' });
  });

  private readonly passwordModel = signal<PasswordChange>({ current: '', next: emptyNewPassword() });
  protected readonly passwordForm = form(this.passwordModel, (path) => {
    required(path.current, { message: 'Escribe tu contraseña actual.' });
    apply(path.next, newPasswordSchema);
  });

  constructor() {
    effect(() => {
      const name = this.session.user()?.name ?? '';
      untracked(() => this.nameModel.set({ name }));
    });
  }

  protected async saveName(event: Event): Promise<void> {
    event.preventDefault();
    const user = this.session.user();
    if (!user) return;
    await submit(this.nameForm, async () => {
      this.directory.updateUser(user.id, { name: this.nameModel().name.trim() });
      this.toaster.show('Nombre actualizado');
      return undefined;
    });
  }

  protected async changePassword(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.passwordForm, async () => {
      this.passwordForm().reset({ current: '', next: emptyNewPassword() });
      this.toaster.show('Contraseña actualizada. Cerramos tus otras sesiones.');
      return undefined;
    });
  }

  protected signOut(): void {
    this.auth.signOut();
    void this.router.navigateByUrl('/login');
  }
}
