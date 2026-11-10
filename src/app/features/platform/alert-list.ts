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
        <span class="mark"><app-icon [name]="alert.kind === 'access_expiring' ? 'clock' : 'alert'" /></span>
        <span><b>{{ alert.tenantName }}</b>{{ alert.text }}</span>
      </a>
    } @empty {
      <p class="empty"><span class="mark"><app-icon name="check" /></span>Todo en orden: ninguna empresa necesita atención.</p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; }
    .alert { display: flex; gap: 12px; align-items: flex-start; padding: 12px 18px; border-top: 1px solid var(--color-border); font-size: 13px;
      line-height: 1.45; color: var(--color-text-muted); }
    .alert:hover { background: var(--color-surface-hover); }
    .alert b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
    .mark { width: 32px; height: 32px; flex: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; --icon-size: 17px; }
    .alert.critical .mark { background: var(--color-danger-soft); color: var(--color-danger); }
    .alert.warning .mark { background: var(--color-warning-soft); color: var(--color-warning); }
    .empty { display: flex; gap: 12px; align-items: center; padding: 14px 18px; color: var(--color-success-text); font-size: 14px; }
    .empty .mark { background: var(--color-success-soft); color: var(--color-success); }
  `,
})
export class AlertList {
  readonly alerts = input.required<PlatformAlert[]>();
}
