import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { toApiFailure } from '../../core/api/api-error';
import { Auth } from '../../core/auth';
import { Session } from '../../core/session';
import { emptyNewPassword, newPasswordSchema } from '../../shared/security/new-password.schema';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { PasswordField } from '../../shared/ui/password-field';
import { PasswordMeter } from '../../shared/ui/password-meter';
import { enterPanel } from './enter-panel';
import { PasswordResetRemote, type ResetLookup } from './password-reset.remote';

/**
 * The page of a password link (mockup web-30): the person chooses their new password, nobody else
 * sees it, and they go straight into the panel (the staff are then asked for their code).
 */
@Component({
  selector: 'app-reset-password-page',
  imports: [PasswordField, FormField, RouterLink, FieldError, Icon, PasswordMeter],
  template: `
    <div class="auth-box">
      @switch (lookup()?.status) {
        @case (undefined) {
          <h2>Elige tu contraseña nueva</h2>
          <p class="lead">Revisando el enlace…</p>
        }
        @case ('valid') {
          <h2>Elige tu contraseña nueva</h2>
          <p class="lead">Hola, <b>{{ firstName() }}</b>. {{ givenBy() }} te dio este enlace para <b>{{ place() }}</b>.</p>
          @if (error(); as message) {
            <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
          }
          <form (submit)="onSubmit($event)" novalidate>
            <div class="field">
              <label for="password">Contraseña nueva</label>
              <app-password-field><input id="password" class="input" type="password" autocomplete="new-password" [formField]="secret.password" /></app-password-field>
              <app-password-meter [password]="secret.password().value()" />
              <app-field-error [state]="secret.password()" />
            </div>
            <div class="field">
              <label for="confirm">Repítela</label>
              <app-password-field><input id="confirm" class="input" type="password" autocomplete="new-password" [formField]="secret.confirm" /></app-password-field>
              <app-field-error [state]="secret.confirm()" />
            </div>
            <button type="submit" class="btn btn--primary btn--block" [disabled]="secret().submitting()" [attr.aria-busy]="secret().submitting()"><span>Guardar y entrar</span></button>
          </form>
          @if (staff()) {
            <p class="field-hint">Al entrar, además te pedirá el código de seguridad de tu teléfono.</p>
          }
        }
        @case ('saved') {
          <h2>Contraseña guardada</h2>
          <div class="form-alert ok" role="status"><app-icon name="check" />Ya puedes entrar con tu contraseña nueva.</div>
          <a class="btn btn--primary btn--block" routerLink="/login"><span>Iniciar sesión</span></a>
        }
        @case ('unavailable') {
          <h2>Elige tu contraseña nueva</h2>
          <div class="form-alert" role="alert"><app-icon name="alert" />No pudimos revisar el enlace. Inténtalo de nuevo en un momento.</div>
          <button type="button" class="btn btn--block" (click)="load()"><span>Reintentar</span></button>
        }
        @default {
          <h2>Este enlace ya no sirve</h2>
          <div class="form-alert warn" role="alert"><app-icon name="alert" />Este enlace venció o ya se usó. Pídele uno nuevo a quien administra tu empresa.</div>
          <p class="lead">Lo mismo si alguien intenta usarlo dos veces: el segundo intento no hace nada.</p>
          <a class="btn btn--block" routerLink="/forgot-password"><span>¿A quién se lo pido?</span></a>
        }
      }
    </div>
  `,
})
export class ResetPasswordPage {
  private readonly remote = inject(PasswordResetRemote);
  private readonly auth = inject(Auth);
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  readonly token = input<string>();

  protected readonly lookup = signal<ResetLookup | { status: 'saved' } | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly secret = form(signal(emptyNewPassword()), newPasswordSchema);

  private readonly preview = computed(() => {
    const found = this.lookup();
    return found?.status === 'valid' ? found.preview : null;
  });
  protected readonly firstName = computed(() => this.preview()?.name.split(' ')[0] ?? '');
  protected readonly givenBy = computed(() => this.preview()?.givenBy ?? 'Vortomi');
  protected readonly place = computed(() => this.preview()?.companyName ?? 'la consola de Vortomi');
  protected readonly staff = computed(() => this.preview()?.staff ?? false);

  constructor() {
    // The token arrives with the route, after construction.
    effect(() => {
      if (this.token() !== undefined) untracked(() => void this.load());
    });
  }

  protected async load(): Promise<void> {
    this.lookup.set(null);
    this.lookup.set(await this.remote.lookup(this.token() ?? ''));
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    await submit(this.secret, async () => {
      const password = this.secret().value().password;
      let email: string;
      try {
        email = (await this.remote.complete(this.token() ?? '', password)).email;
      } catch (error) {
        const failure = toApiFailure(error);
        if (failure.code === 'reset_not_found' || failure.code === 'reset_expired') this.lookup.set({ status: failure.code === 'reset_expired' ? 'expired' : 'missing' });
        else this.error.set(failure.message);
        return undefined;
      }
      // Straight in with the password just chosen; the staff go on to their code.
      const result = await this.auth.signIn(email, password);
      if (result === 'mfa_required') await this.router.navigate(['/login/verify']);
      else if (result === 'signed_in') await enterPanel(this.session, this.router, null);
      else this.lookup.set({ status: 'saved' });
      return undefined;
    });
  }
}
