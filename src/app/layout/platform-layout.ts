import { Component, DestroyRef, inject } from '@angular/core';
import { PlatformData } from '../features/platform/platform.data';
import { PlatformPaymentReview } from '../features/platform/subscriptions/platform-payment-review';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon } from '../shared/ui/icon';
import { PLATFORM_NAV } from './nav';
import { UserMenu } from './user-menu';
import { ThemeToggle } from '../shared/ui/theme-toggle';
import { BRAND } from '../core/brand';
import { BrandMark } from '../shared/ui/brand-mark';

/**
 * Frame of the platform console (/platform), for our own team only.
 * In production the backend enforces the super_admin role; this frame is only the layout.
 */
@Component({
  selector: 'app-platform-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, UserMenu, ThemeToggle, BrandMark],
  template: `
    <aside class="side">
      <div class="brand">
        <app-brand-mark class="logo" />
        <div class="brand-text">
          <p>{{ brand.name }}</p>
          <span>Consola de la plataforma</span>
        </div>
        <app-theme-toggle align="right" />
      </div>
      <div class="badge"><app-icon name="shield" />Solo nuestro equipo. Desde aquí no se pueden leer conversaciones.</div>
      <nav class="nav" aria-label="Menú de la plataforma">
        <h6>Plataforma</h6>
        @for (item of items; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="on"><app-icon [name]="item.icon" />{{ item.label }}
            @if (item.pendingPayments && payments.pending(); as count) {
              <span class="count" [attr.aria-label]="count + ' pagos por revisar'">{{ count }}</span>
            }
            @if (item.criticalAlerts && data.criticalAlerts(); as count) {
              <span class="count crit" [attr.aria-label]="count + ' alertas críticas'">{{ count }}</span>
            }
          </a>
        }
      </nav>
      <app-user-menu area="platform" class="user" />
    </aside>
    <main class="main"><router-outlet /></main>
  `,
  styles: `
    @use 'mixins';
    @use 'sidebar';
    :host { display: flex; height: 100dvh; overflow: hidden; }
    .side { @include sidebar.panel(var(--color-console-side)); }
    .brand { @include sidebar.brand; .brand-text { flex: 1; min-width: 0; } }
    .nav { @include sidebar.nav; }
    .user { margin-top: auto; }
    .nav .count.crit { background: var(--color-danger); color: #fff; }
    .badge { margin: 0 2px 14px; background: var(--color-console-badge-bg); border: 1px solid var(--color-console-badge-border);
      color: var(--color-console-badge-text); border-radius: var(--radius-md); padding: 9px 11px; font-size: 12px;
      line-height: 1.4; display: flex; gap: 8px; --icon-size: 16px; }
    .main { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--color-canvas); }
    @include mixins.phone { .side { display: none; } }
  `,
})
export class PlatformLayout {
  protected readonly brand = BRAND;
  /** The same data the console pages load: the red count follows the alerts they read. */
  protected readonly data = inject(PlatformData);
  protected readonly items = PLATFORM_NAV;
  /** Payments waiting for review: the count beside Suscripciones (mockup web-41), read every 2 minutes. */
  protected readonly payments = inject(PlatformPaymentReview);

  constructor() {
    void this.payments.refreshPending();
    const timer = setInterval(() => void this.payments.refreshPending(), 120_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
