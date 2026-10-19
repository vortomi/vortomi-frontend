import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import type { PlatformAlert } from './platform-alerts';

/** Alert rows linking to the company. Used by the dashboard card and the alerts page. */
@Component({
  selector: 'app-alert-list',
  imports: [RouterLink, Icon],
  template: `
    @for (alert of alerts(); track alert.id) {
      <a class="alert" [routerLink]="['/platform/tenants', alert.tenantId]" [class]="alert.severity">
        <app-icon [name]="alert.kind === 'access_expiring' ? 'clock' : 'alert'" />
        <span><b>{{ alert.tenantName }}</b>{{ alert.text }}</span>
      </a>
    } @empty {
      <p class="empty"><app-icon name="check" />Todo en orden: ninguna empresa necesita atención.</p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; }
    .alert { display: flex; gap: 10px; padding: 11px 16px; border-top: 1px solid var(--color-border-soft); font-size: 12.8px;
      line-height: 1.42; color: var(--color-text-muted); --icon-size: 18px; }
    .alert:hover { background: #fafbff; }
    .alert b { display: block; font-size: 13.3px; color: var(--color-text); }
    .alert.critical app-icon { color: #a8231a; }
    .alert.warning app-icon { color: #b45309; }
    .empty { display: flex; gap: 8px; align-items: center; padding: 14px 16px; color: #166534; font-size: 13px; --icon-size: 17px; }
  `,
})
export class AlertList {
  readonly alerts = input.required<PlatformAlert[]>();
}
