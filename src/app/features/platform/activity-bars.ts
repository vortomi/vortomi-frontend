import { Component, computed, input } from '@angular/core';

/** A row's last days of messages as small bars, today highlighted (mockup web-25, the list). */
@Component({
  selector: 'app-mini-bars',
  template: `
    @for (bar of bars(); track $index) {
      <i [style.height.%]="bar" [class.today]="$last"></i>
    }
  `,
  styles: `
    :host { display: flex; align-items: flex-end; gap: 2px; height: 22px; width: 70px; }
    i { flex: 1; min-height: 1px; border-radius: 1px; background: var(--color-primary-soft, color-mix(in srgb, var(--color-primary) 25%, transparent)); }
    i.today { background: var(--color-primary); }
  `,
  host: { 'aria-hidden': 'true' },
})
export class MiniBars {
  readonly values = input.required<number[]>();
  protected readonly bars = computed(() => {
    const max = Math.max(1, ...this.values());
    return this.values().map((v) => Math.max(4, Math.round((v / max) * 100)));
  });
}

/** Thirty days of messages, customers' below and the company's above (mockup web-25, the page). */
@Component({
  selector: 'app-activity-chart',
  template: `
    <div class="plot" role="img" [attr.aria-label]="summary()">
      @for (day of days(); track day.day) {
        <span class="day" [title]="day.title">
          <i class="company" [style.height.%]="day.company"></i>
          <i class="customers" [style.height.%]="day.customers"></i>
        </span>
      }
    </div>
    <div class="axis">
      @for (tick of ticks(); track tick) { <span>{{ tick }}</span> }
    </div>
    <div class="legend">
      <span><i class="customers"></i>De los clientes</span>
      <span><i class="company"></i>De la empresa (equipo, agente y dueño)</span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .plot { display: flex; align-items: flex-end; gap: 4px; height: 140px; border-bottom: 1px solid var(--color-border); }
    .day { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; gap: 1px; }
    .day i { display: block; border-radius: 2px 2px 0 0; min-height: 0; }
    .customers { background: var(--color-primary); }
    .company { background: color-mix(in srgb, var(--color-primary) 28%, transparent); }
    .axis { display: flex; justify-content: space-between; font-size: 11px; color: var(--color-text-faint); margin-top: 4px; }
    .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--color-text-muted); margin-top: 8px; }
    .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
  `,
})
export class ActivityChart {
  readonly daily = input.required<{ day: string; fromCustomers: number; fromCompany: number }[]>();

  protected readonly days = computed(() => {
    const max = Math.max(1, ...this.daily().map((d) => d.fromCustomers + d.fromCompany));
    return this.daily().map((d) => ({
      day: d.day,
      customers: (d.fromCustomers / max) * 100,
      company: (d.fromCompany / max) * 100,
      title: `${shortDay(d.day)}: ${d.fromCustomers} de clientes, ${d.fromCompany} de la empresa`,
    }));
  });
  /** First, every 7th and last day. */
  protected readonly ticks = computed(() => {
    const days = this.daily();
    return days.filter((_, i) => i === days.length - 1 || i % 7 === 0).map((d) => shortDay(d.day));
  });
  protected readonly summary = computed(() => {
    const total = this.daily().reduce((sum, d) => sum + d.fromCustomers + d.fromCompany, 0);
    return `Mensajes de los últimos ${this.daily().length} días: ${total}`;
  });
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "2026-11-18" → "18 nov". */
const shortDay = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
