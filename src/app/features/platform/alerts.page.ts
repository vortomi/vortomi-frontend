import { Component, computed, inject, signal } from '@angular/core';
import { AlertList } from './alert-list';
import type { AlertSeverity } from './platform-alerts';
import { PlatformData } from './platform.data';

@Component({
  selector: 'app-alerts-page',
  imports: [AlertList],
  template: `
    <header class="page-top">
      <h1>Alertas</h1>
      <span class="sub">Lo que hay que resolver con cada empresa antes de que afecte su atención</span>
      <span class="spacer"></span>
      <div class="seg" role="tablist">
        @for (option of options; track option.id) {
          <button type="button" role="tab" [class.on]="severity() === option.id" (click)="severity.set(option.id)">
            {{ option.label }} · {{ count(option.id) }}
          </button>
        }
      </div>
    </header>
    <div class="page-body">
      <div class="card list"><app-alert-list [alerts]="visible()" /></div>
    </div>
  `,
  styleUrl: './platform-pages.scss',
  styles: `
    .list { max-width: 820px; overflow: hidden; }
    .seg { display: inline-flex; background: #eef0f4; border-radius: 9px; padding: 3px; gap: 2px; }
    .seg button { border: 0; background: none; font-size: 12.5px; padding: 6px 11px; border-radius: 7px; color: #4b5565; cursor: pointer; }
    .seg button.on { background: #fff; color: var(--color-text); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
  `,
})
export class AlertsPage {
  private readonly data = inject(PlatformData);

  constructor() {
    void this.data.load();
  }

  protected readonly options: { id: AlertSeverity | 'all'; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'critical', label: 'Críticas' },
    { id: 'warning', label: 'Avisos' },
  ];
  protected readonly severity = signal<AlertSeverity | 'all'>('all');
  protected readonly visible = computed(() =>
    this.data.alerts().filter((a) => this.severity() === 'all' || a.severity === this.severity()),
  );

  protected count(id: AlertSeverity | 'all'): number {
    return this.data.alerts().filter((a) => id === 'all' || a.severity === id).length;
  }
}
