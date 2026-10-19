import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatWeekdayDay } from '../../shared/format/date-time';
import type { DayBar } from './reports.rules';

/** Axis top and step: about four gridlines on round numbers (25, 50, 100…). */
export function niceScale(peak: number): { max: number; step: number } {
  if (peak <= 0) return { max: 4, step: 1 };
  const raw = peak / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw && Number.isInteger(s)) ?? 10 * magnitude;
  return { max: Math.ceil(peak / step) * step, step };
}

const MAX_LABELS = 10;

/** Conversations received per day next to the ones answered within 15 minutes (mockup web-5). */
@Component({
  selector: 'app-daily-chart',
  template: `
    <div class="plot" role="img" [attr.aria-label]="summary()">
      <div class="grid" aria-hidden="true">
        @for (tick of ticks(); track tick) {
          <span [style.bottom.%]="(tick / scale().max) * 100"><i>{{ tick }}</i></span>
        }
      </div>
      @for (bar of view(); track bar.date) {
        <div class="day" [title]="bar.title" aria-hidden="true">
          <div class="pair">
            <i class="received" [style.height.%]="bar.received"></i>
            <i class="on-time" [style.height.%]="bar.onTime"></i>
          </div>
          <span class="label">{{ bar.label }}</span>
        </div>
      }
    </div>
    <table class="visually-hidden">
      <caption>Conversaciones por día</caption>
      <thead><tr><th>Día</th><th>Recibidas</th><th>Respondidas en menos de 15 min</th></tr></thead>
      <tbody>
        @for (bar of bars(); track bar.date) {
          <tr><td>{{ bar.date }}</td><td>{{ bar.conversations }}</td><td>{{ bar.onTime }}</td></tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host { display: block; }
    .plot { position: relative; display: flex; align-items: stretch; gap: 4px; height: 230px; padding-left: 32px; }
    .grid { position: absolute; inset: 0 0 24px 32px; pointer-events: none; }
    .grid span { position: absolute; left: 0; right: 0; border-top: 1px solid var(--color-border-soft); }
    .grid i { position: absolute; right: calc(100% + 8px); top: -8px; font-style: normal; font-size: 11.5px;
      color: var(--color-text-faint); }
    .day { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .pair { flex: 1; display: flex; align-items: flex-end; justify-content: center; gap: 3px; position: relative; }
    .pair i { flex: 0 1 18px; min-width: 3px; border-radius: 4px 4px 0 0; }
    .received { background: #c9cff7; }
    .on-time { background: var(--color-primary); }
    .label { height: 24px; line-height: 24px; text-align: center; font-size: 11.5px; color: var(--color-text-muted);
      white-space: nowrap; overflow: visible; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyChart {
  readonly bars = input.required<DayBar[]>();

  protected readonly scale = computed(() => niceScale(Math.max(0, ...this.bars().map((b) => b.conversations))));

  protected readonly ticks = computed(() => {
    const { max, step } = this.scale();
    return Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  });

  protected readonly view = computed(() => {
    const { max } = this.scale();
    const bars = this.bars();
    // Long periods would overlap their labels: show one every few days.
    const every = Math.ceil(bars.length / MAX_LABELS);
    return bars.map((bar, i) => ({
      date: bar.date,
      received: (bar.conversations / max) * 100,
      onTime: (bar.onTime / max) * 100,
      label: i % every === 0 ? formatWeekdayDay(bar.date) : '',
      title: `${formatWeekdayDay(bar.date)}: ${bar.conversations} recibidas, ${bar.onTime} a tiempo`,
    }));
  });

  protected readonly summary = computed(() => {
    const total = this.bars().reduce((sum, b) => sum + b.conversations, 0);
    return `Conversaciones por día: ${total} en ${this.bars().length} días`;
  });
}
