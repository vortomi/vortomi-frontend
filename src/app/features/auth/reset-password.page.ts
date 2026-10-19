import { Component, computed, input, signal } from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { emptyNewPassword, newPasswordSchema } from '../../shared/security/new-password.schema';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { PasswordMeter } from '../../shared/ui/password-meter';

/** Prototype: only this token is "valid"; the backend will check a hashed, single-use, 1 h token. */
const DEMO_RESET_TOKEN = 'demo-reset';

@Component({
  selector: 'app-reset-password-page',
  imports: [FormField, RouterLink, FieldError, Icon, PasswordMeter],
  template: `
    <div class="auth-box">
      <h2>Crea una contraseña nueva</h2>
      @if (!validToken()) {
        <div class="form-alert" role="alert"><app-icon name="alert" />Este enlace no es válido o ya venció. Pide uno nuevo.</div>
        <a class="btn btn--primary btn--block" routerLink="/forgot-password">Pedir otro enlace</a>
      } @else if (done()) {
        <div class="form-alert ok" role="status"><app-icon name="check" />Listo. Cerramos las demás sesiones abiertas de tu cuenta por seguridad.</div>
        <a class="btn btn--primary btn--block" routerLink="/login">Iniciar sesión</a>
      } @else {
        <form (submit)="onSubmit($event)" novalidate>
          <div class="field">
            <label for="password">Contraseña nueva</label>
            <input id="password" class="input" type="password" autocomplete="new-password" [formField]="secret.password" />
            <app-password-meter [password]="secret.password().value()" />
            <app-field-error [state]="secret.password()" />
          </div>
          <div class="field">
            <label for="confirm">Repítela</label>
            <input id="confirm" class="input" type="password" autocomplete="new-password" [formField]="secret.confirm" />
            <app-field-error [state]="secret.confirm()" />
          </div>
          <button type="submit" class="btn btn--primary btn--block">Guardar contraseña</button>
        </form>
      }
    </div>
  `,
})
export class ResetPasswordPage {
  readonly token = input<string>();

  protected readonly validToken = computed(() => this.token() === DEMO_RESET_TOKEN);
  protected readonly done = signal(false);
  protected readonly secret = form(signal(emptyNewPassword()), newPasswordSchema);

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.secret, async () => {
      this.done.set(true);
      return undefined;
    });
  }
}
