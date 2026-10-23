import { Component, inject, input, signal } from '@angular/core';
import { DomSanitizer, type SafeUrl } from '@angular/platform-browser';
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { safeReturnUrl } from '../../core/landing';
import { type Enrollment, SecondFactor } from '../../core/second-factor';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';

/**
 * First time into the console: adds the authenticator app (Google Authenticator, Microsoft
 * Authenticator...). From then on, signing in to the console asks for its 6-digit code.
 */
@Component({
  selector: 'app-second-factor-setup-page',
  imports: [FormField, FieldError, Icon],
  template: `
    <div class="auth-box">
      <h2>Protege tu acceso a la consola</h2>
      <p class="lead">
        Desde la consola se ven todas las empresas, así que además de tu contraseña te pediremos un código de tu teléfono.
        Lo configuras una sola vez.
      </p>
      @if (error(); as message) {
        <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
      }
      @if (enrollment(); as e) {
        <ol class="steps">
          <li>Instala en tu teléfono <b>Google Authenticator</b> o <b>Microsoft Authenticator</b>.</li>
          <li>En la aplicación, toca <b>agregar</b> y escanea este código:</li>
        </ol>
        <img class="qr" [src]="qr()" alt="Código para escanear con la aplicación" width="180" height="180" />
        <p class="field-hint center">¿No puedes escanear? Escribe esta clave en la aplicación: <span class="mono">{{ e.secret }}</span></p>
        <form (submit)="onSubmit($event)" novalidate>
          <div class="field">
            <label for="code">3. Escribe el código de 6 dígitos que muestra la aplicación</label>
            <input id="code" class="input code" inputmode="numeric" autocomplete="one-time-code" [formField]="verification.code" />
            <app-field-error [state]="verification.code()" />
          </div>
          <button type="submit" class="btn btn--primary btn--block" [disabled]="verification().submitting()" [attr.aria-busy]="verification().submitting()">
            @if (verification().submitting()) { <span class="spinner" aria-hidden="true"></span> } @else { Activar y entrar }
          </button>
        </form>
      } @else if (!error()) {
        <p class="lead center"><span class="spinner" aria-hidden="true"></span></p>
      }
    </div>
  `,
  styles: `
    .steps { margin-left: 18px; font-size: 14px; line-height: 1.6; }
    .qr { display: block; margin: 4px auto; border-radius: var(--radius-md); background: #fff; padding: 8px; }
    .center { text-align: center; }
    .mono { font-family: var(--font-mono); word-break: break-all; }
    .code { letter-spacing: 8px; font-size: 20px; text-align: center; font-family: var(--font-mono); }
  `,
})
export class SecondFactorSetupPage {
  private readonly secondFactor = inject(SecondFactor);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  readonly returnUrl = input<string>();

  protected readonly enrollment = signal<Enrollment | null>(null);
  protected readonly qr = signal<SafeUrl>('');
  protected readonly error = signal<string | null>(null);
  protected readonly verification = form(signal({ code: '' }), (path) => {
    required(path.code, { message: 'Escribe el código.' });
    pattern(path.code, /^\d{6}$/, { message: 'Son 6 números.' });
    maxLength(path.code, 6);
  });

  constructor() {
    void this.start();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const enrollment = this.enrollment();
    if (!enrollment) return;
    await submit(this.verification, async () => {
      if (!(await this.secondFactor.verify(this.verification().value().code, enrollment.factorId))) {
        this.error.set('Ese código no es válido o ya venció. Escribe el que muestra ahora la aplicación.');
        return undefined;
      }
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? '/platform');
      return undefined;
    });
  }

  private async start(): Promise<void> {
    try {
      const enrollment = await this.secondFactor.enroll();
      // Supabase gives the image as an SVG data URL it generated; marked safe for <img> only.
      this.qr.set(this.sanitizer.bypassSecurityTrustUrl(enrollment.qrCode));
      this.enrollment.set(enrollment);
    } catch {
      this.error.set('No se pudo preparar el código. Recarga la página para intentarlo de nuevo.');
    }
  }
}
