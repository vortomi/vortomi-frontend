import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Icon } from '../shared/ui/icon';
import { BRAND } from '../core/brand';
import { ThemeToggle } from '../shared/ui/theme-toggle';
import { BrandMark } from '../shared/ui/brand-mark';

/** Split screen for sign-in, password and invitation pages (mockup web-13). */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, Icon, ThemeToggle, BrandMark],
  template: `
    <aside class="hero">
      <div class="brand">
        <app-brand-mark class="logo" />
        <div>
          <p>{{ brand.name }}</p>
          <span>{{ brand.tagline }}</span>
        </div>
      </div>
      <h1>Atiende el WhatsApp de tu empresa en equipo.</h1>
      <p class="lead">Todos tus números en una sola bandeja, cada persona con lo suyo y tus datos aislados de cualquier otra empresa.</p>
      <ul>
        <li><app-icon name="inbox" />Una bandeja para todos tus números</li>
        <li><app-icon name="users" />Cada agente ve lo que le toca</li>
        <li><app-icon name="shield" />Nadie de otra empresa ve tus conversaciones</li>
      </ul>
    </aside>
    <main class="panel">
      <app-theme-toggle class="theme" align="right" />
      <div class="mobile-brand"><app-brand-mark class="logo" /><b>{{ brand.name }}</b></div>
      <router-outlet />
    </main>
  `,
  styles: `
    @use 'mixins';
    @use 'sidebar';
    :host { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 100dvh; }
    .hero { background: radial-gradient(700px 420px at 0% 100%, rgba(0, 240, 255, 0.16), transparent 60%),
        radial-gradient(700px 480px at 100% 0%, rgba(61, 91, 255, 0.3), transparent 60%), var(--brand-ink);
      color: #dbe2ef; padding: 44px 56px;
      display: flex; flex-direction: column; gap: 22px; }
    .brand { @include sidebar.brand; padding: 0; }
    .brand p { color: #fff; }
    .brand span { color: #9fb0d0; }
    h1 { color: #fff; font-size: 30px; line-height: 1.25; margin-top: 40px; max-width: 520px; }
    .lead { font-size: 15px; line-height: 1.55; color: #b9c4da; max-width: 520px; }
    ul { list-style: none; display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
    li { display: flex; gap: 10px; align-items: center; font-size: 14px; --icon-size: 19px; }
    li app-icon { color: var(--brand-cyan); }
    .panel { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 32px 20px;
      background: var(--color-canvas); }
    .theme { position: absolute; top: 18px; right: 18px; }
    .mobile-brand { display: none; align-items: center; gap: 10px; font-size: 16px; }
    @include mixins.below-tablet {
      :host { grid-template-columns: 1fr; }
      .hero { display: none; }
      .mobile-brand { display: flex; }
    }
  `,
})
export class AuthLayout {
  protected readonly brand = BRAND;
}
