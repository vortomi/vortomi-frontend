import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Icon } from '../shared/ui/icon';
import { BRAND } from '../core/brand';

/** Split screen for sign-in, password and invitation pages (mockup web-13). */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, Icon],
  template: `
    <aside class="hero">
      <div class="brand">
        <div class="logo">{{ brand.initial }}</div>
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
      <div class="mobile-brand"><div class="logo">{{ brand.initial }}</div><b>{{ brand.name }}</b></div>
      <router-outlet />
    </main>
  `,
  styles: `
    @use 'mixins';
    @use 'sidebar';
    :host { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 100dvh; }
    .hero { background: var(--color-side); color: var(--color-side-text); padding: 44px 56px; display: flex;
      flex-direction: column; gap: 22px; }
    .brand { @include sidebar.brand; padding: 0; }
    h1 { color: #fff; font-size: 30px; line-height: 1.25; margin-top: 40px; max-width: 520px; }
    .lead { font-size: 15px; line-height: 1.55; color: #aab1c8; max-width: 520px; }
    ul { list-style: none; display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
    li { display: flex; gap: 10px; align-items: center; font-size: 14px; --icon-size: 19px; }
    li app-icon { color: #8fa0ff; }
    .panel { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 32px 20px;
      background: var(--color-canvas); }
    .mobile-brand { display: none; align-items: center; gap: 10px; font-size: 16px; }
    .mobile-brand .logo { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, #4f63f0, #2b3fc4);
      color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
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
