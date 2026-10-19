import { Component, inject, input, signal } from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { resolveLanding, safeReturnUrl } from '../../core/landing';
import { Session } from '../../core/session';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { BRAND } from '../../core/brand';

/** Prototype shortcuts: one account per role. Remove with the mock data. */
const DEMO_ACCOUNTS = [
  { email: 'laura@repuestosandinos.com', label: 'Laura · admin' },
  { email: 'carlos@repuestosandinos.com', label: 'Carlos · agente' },
  { email: 'elena@muebleriavalle.com', label: 'Elena · mueblería' },
  { email: 'gabriela@dentalsonrisa.com', label: 'Gabriela · clínica' },
  { email: 'valeria.gil@gmail.com', label: 'Valeria · dos empresas' },
  { email: 'yornel@vortomi.com', label: 'Yornel · nuestro equipo' },
];

@Component({
  selector: 'app-login-page',
  imports: [FormField, RouterLink, FieldError, Icon],
  templateUrl: './login.page.html',
})
export class LoginPage {
  protected readonly brand = BRAND;
  private readonly auth = inject(Auth);
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  /** From the query string (?returnUrl=...), sanitised before use. */
  readonly returnUrl = input<string>();

  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly error = signal<string | null>(null);
  protected readonly credentials = form(signal({ email: '', password: '' }), (path) => {
    required(path.email, { message: 'Escribe tu correo.' });
    email(path.email, { message: 'Ese correo no parece válido.' });
    required(path.password, { message: 'Escribe tu contraseña.' });
  });

  protected useDemo(address: string): void {
    this.credentials.email().value.set(address);
    this.credentials.password().value.set('prototipo');
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    await submit(this.credentials, async () => {
      const { email: address, password } = this.credentials().value();
      const result = await this.auth.signIn(address, password);
      const returnUrl = safeReturnUrl(this.returnUrl());
      switch (result) {
        case 'mfa_required':
          await this.router.navigate(['/login/verify'], { queryParams: { returnUrl } });
          break;
        case 'signed_in':
          await this.goToLanding(returnUrl);
          break;
        case 'locked':
          this.error.set('Demasiados intentos fallidos. Espera 15 minutos o recupera tu contraseña.');
          break;
        case 'invalid':
          // Same message whether the email exists or not: no account enumeration.
          this.error.set('Correo o contraseña incorrectos.');
          break;
      }
      return undefined;
    });
  }

  private async goToLanding(returnUrl: string | null): Promise<void> {
    const landing = resolveLanding({
      isSuperAdmin: this.session.isSuperAdmin(),
      enterableTenantIds: this.session.enterableTenantIds(),
      returnUrl,
    });
    if (landing.selectTenantId) this.session.switchTenant(landing.selectTenantId);
    await this.router.navigateByUrl(landing.path);
  }
}
