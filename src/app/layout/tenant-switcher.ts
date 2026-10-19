import { Component, computed, inject, signal } from '@angular/core';
import { Session } from '../core/session';
import { Workspace } from '../core/workspace';
import { Avatar } from '../shared/ui/avatar';
import { Icon } from '../shared/ui/icon';

/** Active company chip. Opens a menu only when the person belongs to more than one company. */
@Component({
  selector: 'app-tenant-switcher',
  imports: [Avatar, Icon],
  template: `
    @if (session.tenant(); as tenant) {
      <button class="chip" type="button" [disabled]="!canSwitch()" (click)="open.set(!open())" [attr.aria-expanded]="open()">
        @if (workspace.settings()?.logoDataUrl; as logo) {
          <img class="logo" [src]="logo" alt="" />
        } @else {
          <app-avatar class="logo" [name]="tenant.name" [seed]="tenant.id" />
        }
        <span class="text">
          <b>{{ tenant.name }}</b>
          <small>{{ summary() }}</small>
        </span>
        @if (canSwitch()) {
          <app-icon name="swap" />
        }
      </button>
      @if (open()) {
        <ul class="menu" role="menu">
          @for (option of session.myTenants(); track option.id) {
            <li>
              <button type="button" role="menuitem" [class.on]="option.id === tenant.id" (click)="choose(option.id)">
                <app-avatar size="sm" [name]="option.name" [seed]="option.id" />{{ option.name }}
              </button>
            </li>
          }
        </ul>
      }
    }
  `,
  styleUrl: './tenant-switcher.scss',
})
export class TenantSwitcher {
  protected readonly session = inject(Session);
  protected readonly workspace = inject(Workspace);

  protected readonly open = signal(false);
  protected readonly canSwitch = computed(() => this.session.myTenants().length > 1);

  protected readonly summary = computed(() => {
    const numbers = this.workspace.channels().length;
    const agents = this.workspace.activeTeam().length;
    return `${numbers} ${numbers === 1 ? 'número' : 'números'} · ${agents} ${agents === 1 ? 'persona' : 'personas'}`;
  });

  protected choose(tenantId: string): void {
    this.session.switchTenant(tenantId);
    this.open.set(false);
  }
}
