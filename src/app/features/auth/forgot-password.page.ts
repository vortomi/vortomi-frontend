import { Component, signal } from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { BRAND } from '../../core/brand';

/** Always shows the same confirmation, so nobody can find out which emails have an account. */
@Component({
  selector: 'app-forgot-password-page',
  imports: [FormField, RouterLink, FieldError, Icon],
  template: `
    <div class="auth-box">
      <h2>Recupera tu contraseña</h2>
      @if (sentTo(); as address) {
        <div class="form-alert ok" role="status">
          <app-icon name="mail" />
          <span>Si <b>{{ address }}</b> tiene una cuenta en {{ brand.name }}, te llegará un enlace para crear una contraseña nueva. Sirve una sola vez y vence en 1 hora.</span>
        </div>
        <a class="btn btn--block" routerLink="/login">Volver a iniciar sesión</a>
        <div class="demo-box">
          <b>Prototipo</b>No se envían correos. <a class="link" routerLink="/reset-password/demo-reset">Abrir el enlace del correo</a>
        </div>
      } @else {
        <p class="lead">Escribe el correo con el que entras y te enviamos un enlace.</p>
        <form (submit)="onSubmit($event)" novalidate>
          <div class="field">
            <label for="email">Correo</label>
            <input id="email" class="input" type="email" autocomplete="username" [formField]="request.email" />
            <app-field-error [state]="request.email()" />
          </div>
          <button type="submit" class="btn btn--primary btn--block">Enviar enlace</button>
        </form>
        <a class="link" routerLink="/login">Volver a iniciar sesión</a>
      }
    </div>
  `,
})
export class ForgotPasswordPage {
  protected readonly brand = BRAND;
  protected readonly sentTo = signal<string | null>(null);
  protected readonly request = form(signal({ email: '' }), (path) => {
    required(path.email, { message: 'Escribe tu correo.' });
    email(path.email, { message: 'Ese correo no parece válido.' });
  });

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.request, async () => {
      this.sentTo.set(this.request().value().email.trim());
      return undefined;
    });
  }
}
