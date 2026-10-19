import { Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../core/auth';
import { Session } from '../core/session';
import { Avatar } from '../shared/ui/avatar';
import { Icon } from '../shared/ui/icon';

/** Person block at the bottom of a sidebar, with profile, company switch, console and sign-out. */
@Component({
  selector: 'app-user-menu',
  imports: [RouterLink, Avatar, Icon],
  host: { '(document:click)': 'closeOnOutsideClick($event)' },
  template: `
    @if (session.user(); as user) {
      @if (open()) {
        <ul class="menu" role="menu">
          <li><a role="menuitem" [routerLink]="profileLink()" (click)="open.set(false)"><app-icon name="users" />Mi perfil</a></li>
          @if (canSwitch()) {
            <li><a role="menuitem" routerLink="/select-company" (click)="open.set(false)"><app-icon name="swap" />Cambiar de empresa</a></li>
          }
          @if (session.isSuperAdmin() && area() === 'tenant') {
            <li><a role="menuitem" routerLink="/platform" (click)="open.set(false)"><app-icon name="shield" />Consola de la plataforma</a></li>
          }
          <li><button type="button" role="menuitem" (click)="signOut()"><app-icon name="back" />Cerrar sesión</button></li>
        </ul>
      }
      <button type="button" class="who" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="menu">
        <app-avatar [name]="user.name" [seed]="user.id" />
        <span class="text">
          <b>{{ user.name }}</b>
          <small>{{ roleLabel() }}</small>
        </span>
        <app-icon name="down" class="chev" />
      </button>
    }
  `,
  styles: `
    @use 'mixins';
    :host { display: block; position: relative; margin-top: 12px; border-top: 1px solid #2a3149; padding-top: 10px; }
    .who { width: 100%; display: flex; align-items: center; gap: 10px; padding: 6px 8px; border: 0; background: none;
      border-radius: var(--radius-sm); cursor: pointer; text-align: left; color: var(--color-side-muted); --icon-size: 15px; }
    .who:hover { background: rgba(255, 255, 255, 0.05); }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    b { font-size: 13px; color: #fff; font-weight: 500; @include mixins.ellipsis; }
    small { font-size: 12px; }
    .chev { transform: rotate(180deg); }
    .menu { position: absolute; bottom: calc(100% + 6px); left: 0; right: 0; list-style: none; background: var(--color-surface);
      border-radius: var(--radius-md); box-shadow: var(--shadow-pop); padding: 6px; z-index: 30; }
    .menu a, .menu button { width: 100%; display: flex; align-items: center; gap: 9px; padding: 9px 10px; border: 0;
      background: none; border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); cursor: pointer;
      --icon-size: 16px; }
    .menu a:hover, .menu button:hover { background: var(--color-primary-soft); }
  `,
})
export class UserMenu {
  protected readonly session = inject(Session);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Which frame the menu lives in: the company panel or the platform console. */
  readonly area = input<'tenant' | 'platform'>('tenant');

  protected readonly open = signal(false);
  protected readonly canSwitch = computed(
    () => this.session.isSuperAdmin() || this.session.enterableTenantIds().length > 1,
  );
  protected readonly profileLink = computed(() => (this.area() === 'platform' ? '/platform/profile' : '/profile'));
  protected readonly roleLabel = computed(() => {
    if (this.area() === 'platform') return 'Super admin';
    return this.session.membership()?.role === 'admin' ? 'Admin de la empresa' : 'Agente';
  });

  protected closeOnOutsideClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  protected signOut(): void {
    this.auth.signOut();
    void this.router.navigateByUrl('/login');
  }
}
