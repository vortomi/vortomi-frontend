import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../../core/brand';
import { Icon } from '../../shared/ui/icon';

/**
 * «¿Olvidaste tu contraseña?» (mockup web-30): Vortomi sends no emails. It says who gives the
 * one-time link to choose a new one: the owner of the company, Vortomi, or another staff member.
 */
@Component({
  selector: 'app-forgot-password-page',
  imports: [RouterLink, Icon],
  template: `
    <div class="auth-box">
      <h2>¿Olvidaste tu contraseña?</h2>
      <p class="lead">Pide un enlace para elegir una nueva a quien corresponde:</p>
      <ul class="who">
        <li>
          <span class="ic blue"><app-icon name="users" /></span>
          <div><b>Trabajas en una empresa</b><small>Al <strong>dueño</strong> de tu empresa. Lo hace desde Canales y equipo, en un minuto.</small></div>
        </li>
        <li>
          <span class="ic amber"><app-icon name="sparkles" /></span>
          <div>
            <b>Eres el dueño, o trabajas en varias empresas</b>
            <small>A <strong>{{ brand.name }}</strong>: escríbenos a <a class="link" [href]="'mailto:' + brand.supportEmail">{{ brand.supportEmail }}</a> y te lo enviamos.</small>
          </div>
        </li>
        <li>
          <span class="ic violet"><app-icon name="shield" /></span>
          <div><b>Eres del staff de {{ brand.name }}</b><small>A otra persona del staff, desde Staff.</small></div>
        </li>
      </ul>
      <p class="field-hint">Tu contraseña es solo tuya: ni {{ brand.name }} ni tu empresa la conocen. El enlace sirve 24 horas y una sola vez.</p>
      <a class="link back" routerLink="/login">‹ Volver a iniciar sesión</a>
    </div>
  `,
  styles: `
    .who { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .who li { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); }
    .who b { display: block; font-size: 14px; }
    .who small { display: block; font-size: 13px; line-height: 1.45; color: var(--color-text-2); margin-top: 2px; }
    .ic { width: 32px; height: 32px; flex: none; border-radius: var(--radius-sm); display: inline-flex; align-items: center; justify-content: center; --icon-size: 16px; }
    .ic.blue { background: var(--color-info-soft); color: var(--color-info-text); }
    .ic.amber { background: var(--color-warning-soft); color: var(--color-warning-text); }
    .ic.violet { background: var(--color-violet-soft); color: var(--color-violet-text); }
    .back { align-self: center; }
  `,
})
export class ForgotPasswordPage {
  protected readonly brand = BRAND;
}
