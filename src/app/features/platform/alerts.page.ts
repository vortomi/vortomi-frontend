import { Component, computed, inject, signal } from '@angular/core';
import { Skeleton } from '../../shared/ui/skeleton';
import { AlertList } from './alert-list';
import type { AlertSeverity } from './platform-alerts';
import { PlatformData } from './platform.data';

@Component({
  selector: 'app-alerts-page',
  imports: [AlertList, Skeleton],
  template: `
    <header class="page-top">
      <h1>Alertas</h1>
      <span class="sub">Lo que hay que resolver con cada empresa antes de que afecte su atención</span>
      <span class="spacer"></span>
      <div class="segmented" role="tablist">
        @for (option of options; track option.id) {
          <button type="button" role="tab" [class.on]="severity() === option.id" [attr.aria-selected]="severity() === option.id" (click)="severity.set(option.id)">
            {{ option.label }}@if (data.ready()) { · {{ count(option.id) }} }
          </button>
        }
      </div>
    </header>
    <div class="page-body">
      <div class="card list">
        @if (data.ready()) {
          <app-alert-list [alerts]="visible()" />
        } @else {
          <app-skeleton class="pad" kind="list" [rows]="4" />
        }
      </div>
    </div>
  `,
  styleUrl: './platform-pages.scss',
  styles: `
    .list { overflow: hidden; }
    .pad { padding: 16px 18px; }
  `,
})
export class AlertsPage {
  protected readonly data = inject(PlatformData);

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
