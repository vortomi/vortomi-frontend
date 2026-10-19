import { Component, inject, input, signal } from '@angular/core';
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { resolveLanding, safeReturnUrl } from '../../core/landing';
import { Session } from '../../core/session';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';

/** Second factor for our own team: an authenticator app code. */
@Component({
  selector: 'app-verify-page',
  imports: [FormField, FieldError, Icon],
  template: `
    <div class="auth-box">
      <h2>Verifica que eres tú</h2>
      <p class="lead">Tu cuenta tiene acceso a la consola de la plataforma. Escribe el código de 6 dígitos de tu aplicación de autenticación.</p>
      @if (error(); as message) {
        <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
      }
      <form (submit)="onSubmit($event)" novalidate>
        <div class="field">
          <label for="code">Código</label>
          <input id="code" class="input code" inputmode="numeric" autocomplete="one-time-code" [formField]="verification.code" />
          <app-field-error [state]="verification.code()" />
        </div>
        <button type="submit" class="btn btn--primary btn--block">Verificar</button>
      </form>
      <button type="button" class="link" (click)="cancel()">Usar otra cuenta</button>
      <div class="demo-box"><b>Prototipo</b>Cualquier código de 6 dígitos sirve, salvo 000000.</div>
    </div>
  `,
  styles: '.code { letter-spacing: 8px; font-size: 20px; text-align: center; font-family: var(--font-mono); }',
})
export class VerifyPage {
  private readonly auth = inject(Auth);
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  readonly returnUrl = input<string>();

  protected readonly error = signal<string | null>(null);
  protected readonly verification = form(signal({ code: '' }), (path) => {
    required(path.code, { message: 'Escribe el código.' });
    pattern(path.code, /^\d{6}$/, { message: 'Son 6 números.' });
    maxLength(path.code, 6);
  });

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.verification, async () => {
      if (!this.auth.verifySecondFactor(this.verification().value().code)) {
        this.error.set('Ese código no es válido o ya venció. Prueba con el siguiente.');
        return undefined;
      }
      const landing = resolveLanding({
        isSuperAdmin: this.session.isSuperAdmin(),
        enterableTenantIds: this.session.enterableTenantIds(),
        returnUrl: safeReturnUrl(this.returnUrl()),
      });
      await this.router.navigateByUrl(landing.path);
      return undefined;
    });
  }

  protected cancel(): void {
    this.auth.signOut();
    void this.router.navigateByUrl('/login');
  }
}
