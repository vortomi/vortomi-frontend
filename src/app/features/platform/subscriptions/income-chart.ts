import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { IncomeBucket } from '../../../shared/api/subscriptions';
import { formatUsdCents } from '../../../shared/format/money';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const W = 600;
const H = 190;
const LEFT = 46;
const BOTTOM = 22;
const TOP = 18;

/** A round top for the axis: 1, 2 or 5 times a power of ten, at least the highest bar. */
function niceMax(cents: number): number {
  if (cents <= 0) return 10000;
  const exp = 10 ** Math.floor(Math.log10(cents));
  return ([1, 2, 5, 10].map((m) => m * exp).find((v) => v >= cents) ?? cents);
}

/**
 * «Ingresos por mes» (mockup web-51): one bar per month (or per day of «Este mes»), the current one
 * darker; hovering one says its period, total and how many payments. A hidden table says the same to
 * screen readers. One series: no legend, the title names it.
 */
@Component({
  selector: 'app-income-chart',
  template: `
    <div class="wrap" (mouseleave)="hover.set(null)">
      <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" [attr.aria-label]="label()">
        @for (tick of ticks(); track tick.y) {
          <line [attr.x1]="left" [attr.x2]="w" [attr.y1]="tick.y" [attr.y2]="tick.y" class="grid" />
          <text [attr.x]="left - 8" [attr.y]="tick.y + 3" class="axis" text-anchor="end">{{ tick.text }}</text>
        }
        @for (bar of bars(); track bar.key) {
          <rect [attr.x]="bar.slot" [attr.y]="top" [attr.width]="slot()" [attr.height]="h - bottom - top" class="hit" (mouseenter)="hover.set(bar.i)" />
          @if (bar.height > 0) {
            <path [attr.d]="bar.path" [class.now]="bar.current" [class.on]="hover() === bar.i" class="bar" />
          }
          @if (bar.showLabel) {
            <text [attr.x]="bar.cx" [attr.y]="h - 6" class="axis" text-anchor="middle">{{ bar.label }}</text>
          }
        }
        <line [attr.x1]="left" [attr.x2]="w" [attr.y1]="h - bottom" [attr.y2]="h - bottom" class="base" />
      </svg>
      @if (hovered(); as b) {
        <div class="tip" [style.left.%]="(b.cx / w) * 100">
          <b>{{ b.title }}</b>
          <span>{{ money(b.cents) }} · {{ b.count }} {{ b.count === 1 ? 'pago' : 'pagos' }}</span>
        </div>
      }
    </div>
    <table class="sr-only">
      <caption>Ingresos por {{ daily() ? 'día' : 'mes' }}</caption>
      <tr><th>{{ daily() ? 'Día' : 'Mes' }}</th><th>Ingresos</th><th>Pagos</th></tr>
      @for (bar of bars(); track bar.key) { <tr><td>{{ bar.title }}</td><td>{{ money(bar.cents) }}</td><td>{{ bar.count }}</td></tr> }
    </table>
  `,
  styles: `
    :host { display: block; }
    .wrap { position: relative; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--color-border); stroke-width: 1; opacity: 0.6; }
    .base { stroke: var(--color-border-strong); stroke-width: 1; }
    .axis { font-size: 10.5px; fill: var(--color-text-muted); }
    .hit { fill: transparent; }
    .bar { fill: color-mix(in srgb, var(--color-primary) 62%, var(--color-surface)); transition: fill 0.12s; pointer-events: none; }
    .bar.now { fill: var(--color-primary); }
    .bar.on { fill: var(--color-primary-text); }
    .tip { position: absolute; top: 0; transform: translate(-50%, -4px); pointer-events: none; padding: 6px 10px; border-radius: var(--radius-sm);
      background: var(--color-surface); border: 1px solid var(--color-border); box-shadow: var(--shadow-pop); font-size: 12.5px; white-space: nowrap;
      display: flex; flex-direction: column; gap: 1px; }
    .tip span { color: var(--color-text-2); font-variant-numeric: tabular-nums; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomeChart {
  readonly buckets = input.required<IncomeBucket[]>();
  /** The bucket that is happening now (this month, or today), drawn darker. */
  readonly current = input<string | null>(null);

  protected readonly w = W;
  protected readonly h = H;
  protected readonly left = LEFT;
  protected readonly top = TOP;
  protected readonly bottom = BOTTOM;
  protected readonly hover = signal<number | null>(null);

  protected readonly daily = computed(() => (this.buckets()[0]?.key.length ?? 7) > 7);
  protected readonly max = computed(() => niceMax(Math.max(0, ...this.buckets().map((b) => b.cents))));
  protected readonly slot = computed(() => (W - LEFT) / Math.max(1, this.buckets().length));
  protected readonly ticks = computed(() => {
    const max = this.max();
    return [0.5, 1].map((f) => ({ y: TOP + (H - BOTTOM - TOP) * (1 - f), text: formatUsdCents(max * f).replace(',00', '') }));
  });

  protected readonly bars = computed(() => {
    const slot = this.slot();
    const plot = H - BOTTOM - TOP;
    const width = Math.max(3, Math.min(30, slot * 0.6));
    const daily = this.daily();
    const every = daily ? 5 : 1;
    return this.buckets().map((b, i) => {
      const height = b.cents > 0 ? Math.max(2, (b.cents / this.max()) * plot) : 0;
      const x = LEFT + slot * i + (slot - width) / 2;
      const y = H - BOTTOM - height;
      const r = Math.min(4, width / 2, height);
      // A rounded top, square at the baseline.
      const path = `M${x} ${H - BOTTOM} V${y + r} a${r} ${r} 0 0 1 ${r} ${-r} h${width - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} V${H - BOTTOM} Z`;
      const day = Number(b.key.slice(8, 10));
      const month = MONTHS[Number(b.key.slice(5, 7)) - 1] ?? '';
      return {
        i,
        key: b.key,
        cents: b.cents,
        count: b.count,
        height,
        path,
        slot: LEFT + slot * i,
        cx: LEFT + slot * i + slot / 2,
        current: b.key === this.current(),
        label: daily ? String(day) : month,
        showLabel: !daily || day === 1 || day % every === 0,
        title: daily ? `${day} ${month} ${b.key.slice(0, 4)}` : `${month} ${b.key.slice(0, 4)}`,
      };
    });
  });

  protected readonly hovered = computed(() => {
    const i = this.hover();
    return i === null ? null : (this.bars()[i] ?? null);
  });

  protected readonly label = computed(() => {
    const total = this.buckets().reduce((s, b) => s + b.cents, 0);
    return `Ingresos por ${this.daily() ? 'día' : 'mes'}: ${formatUsdCents(total)} en total`;
  });

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }
}
