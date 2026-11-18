import { Component, inject, output, signal } from '@angular/core';
import { FormField, apply, form, required, submit } from '@angular/forms/signals';
import { type NewPassword, emptyNewPassword, newPasswordSchema } from '../../shared/security/new-password.schema';
import { Dialog } from '../../shared/ui/dialog';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { PasswordField } from '../../shared/ui/password-field';
import { PasswordMeter } from '../../shared/ui/password-meter';
import { AccountRemote } from './account.remote';
import { AccountSecurity, type PasswordChangeResult } from './account-security';

const REFUSED: Record<Exclude<PasswordChangeResult, 'ok'>, string> = {
  wrong_current: 'Tu contraseña actual no es esa.',
  same: 'La nueva es igual a la actual. Elige otra.',
  weak: 'Esa contraseña es muy fácil de adivinar. Elige otra.',
  failed: 'No se pudo cambiar. Revisa tu contraseña actual e intenta de nuevo.',
};

/**
 * «Cambiar contraseña» (mockup web-29): the current one, the new one twice. Supabase changes it;
 * then every other device is signed out, so whoever had it open elsewhere has to sign in again.
 */
@Component({
  selector: 'app-change-password-dialog',
  imports: [Dialog, FieldError, FormField, Icon, PasswordField, PasswordMeter],
  template: `
    <app-dialog title="Cambiar contraseña" [open]="true" [locked]="passwordForm().submitting()" (closed)="closed.emit(false)">
      @if (error(); as message) {
        <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
      }
      <form id="password-form" (submit)="change($event)" novalidate>
        <div class="field">
          <label for="current">Contraseña actual</label>
          <app-password-field><input id="current" class="input" type="password" autocomplete="current-password" [formField]="passwordForm.current" /></app-password-field>
          <app-field-error [state]="passwordForm.current()" />
        </div>
        <div class="field">
          <label for="next">Contraseña nueva</label>
          <app-password-field><input id="next" class="input" type="password" autocomplete="new-password" [formField]="passwordForm.next.password" /></app-password-field>
          <app-password-meter [password]="passwordForm.next.password().value()" />
          <app-field-error [state]="passwordForm.next.password()" />
        </div>
        <div class="field">
          <label for="confirm">Repítela</label>
          <app-password-field><input id="confirm" class="input" type="password" autocomplete="new-password" [formField]="passwordForm.next.confirm" /></app-password-field>
          <app-field-error [state]="passwordForm.next.confirm()" />
        </div>
      </form>
      <p class="field-hint">Al cambiarla, cerramos tus sesiones en los demás dispositivos.</p>
      <ng-container dialog-actions>
        <button type="button" class="btn" [disabled]="passwordForm().submitting()" (click)="closed.emit(false)"><span>Cancelar</span></button>
        <button type="submit" form="password-form" class="btn btn--primary" [disabled]="passwordForm().submitting()" [attr.aria-busy]="passwordForm().submitting()"><span>Cambiar contraseña</span></button>
      </ng-container>
    </app-dialog>
  `,
  styles: `form { display: flex; flex-direction: column; gap: 12px; }`,
})
export class ChangePasswordDialog {
  private readonly security = inject(AccountSecurity);
  private readonly remote = inject(AccountRemote);
  /** True when the password was changed. */
  readonly closed = output<boolean>();

  protected readonly error = signal<string | null>(null);
  private readonly model = signal<{ current: string; next: NewPassword }>({ current: '', next: emptyNewPassword() });
  protected readonly passwordForm = form(this.model, (path) => {
    required(path.current, { message: 'Escribe tu contraseña actual.' });
    apply(path.next, newPasswordSchema);
  });

  protected async change(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    await submit(this.passwordForm, async () => {
      const result = await this.security.changePassword(this.model().current, this.model().next.password);
      if (result !== 'ok') {
        this.error.set(REFUSED[result]);
        return undefined;
      }
      // The password changed; signing the other devices out is best effort.
      await this.remote.endOtherSessions().catch(() => undefined);
      this.closed.emit(true);
      return undefined;
    });
  }
}
