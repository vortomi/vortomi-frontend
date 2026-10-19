import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { Session } from '../../core/session';
import type { Tenant } from '../../shared/api/models';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';

/** Chooser for people in several companies, and the door to the console for our team. */
@Component({
  selector: 'app-select-company-page',
  imports: [Avatar, Icon],
  template: `
    <div class="auth-box">
      <h2>¿Dónde quieres entrar?</h2>
      <p class="lead">Hola, {{ firstName() }}. Elige con qué empresa vas a trabajar ahora; puedes cambiar cuando quieras.</p>
      <div class="options">
        @if (session.isSuperAdmin()) {
          <button type="button" class="option console" (click)="openConsole()">
            <span class="ico"><app-icon name="shield" /></span>
            <span class="text"><b>Consola de la plataforma</b><small>Todas las empresas, sin acceso a conversaciones</small></span>
          </button>
        }
        @for (tenant of session.myTenants(); track tenant.id) {
          <button type="button" class="option" [disabled]="tenant.status !== 'active'" (click)="enter(tenant)">
            <app-avatar [name]="tenant.name" [seed]="tenant.id" size="md" class="logo" />
            <span class="text">
              <b>{{ tenant.name }}</b>
              <small>{{ tenant.status === 'active' ? roleOf(tenant) : 'Suspendida: habla con nuestro equipo' }}</small>
            </span>
          </button>
        } @empty {
          @if (!session.isSuperAdmin()) {
            <div class="form-alert warn"><app-icon name="alert" />Tu cuenta no tiene empresas activas. Pide a tu administrador que te invite de nuevo.</div>
          }
        }
      </div>
      <button type="button" class="link" (click)="signOut()">Cerrar sesión</button>
    </div>
  `,
  styles: `
    .options { display: flex; flex-direction: column; gap: 10px; }
    .option { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); background: var(--color-surface); text-align: left; cursor: pointer; }
    .option:hover:not(:disabled) { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
    .option:disabled { opacity: 0.6; cursor: not-allowed; }
    .logo { border-radius: 10px; }
    .text { display: flex; flex-direction: column; gap: 2px; }
    .text b { font-size: 14.5px; }
    .text small { font-size: 12.5px; color: var(--color-text-muted); }
    .console { background: #0c1222; border-color: #0c1222; color: #fff; }
    .console small { color: #f6b48c; }
    .ico { width: 38px; height: 38px; border-radius: 10px; background: #2a1a12; color: #f6b48c; display: flex;
      align-items: center; justify-content: center; --icon-size: 20px; }
  `,
})
export class SelectCompanyPage {
  protected readonly session = inject(Session);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly firstName = computed(() => this.session.user()?.name.split(' ')[0] ?? '');

  protected roleOf(tenant: Tenant): string {
    const userId = this.session.user()?.id;
    const role = this.session.memberships().find((m) => m.tenantId === tenant.id && m.userId === userId)?.role;
    return role === 'admin' ? 'Administración' : 'Agente';
  }

  protected enter(tenant: Tenant): void {
    if (this.session.switchTenant(tenant.id)) void this.router.navigateByUrl('/inbox');
  }

  protected openConsole(): void {
    void this.router.navigateByUrl('/platform');
  }

  protected signOut(): void {
    this.auth.signOut();
    void this.router.navigateByUrl('/login');
  }
}
