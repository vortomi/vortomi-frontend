import { Component, computed, inject } from '@angular/core';
import { Workspace } from '../core/workspace';
import { META_RATES_USD, estimateSpend } from '../shared/billing/meta-pricing';
import { formatMonthName } from '../shared/format/date-time';
import { formatCount, formatUnitPrice, formatUsdCents } from '../shared/format/money';

/** Meta consumption of the month, always visible (original document: measure usage per company from day one). */
@Component({
  selector: 'app-usage-meter',
  // Without data (an agent, or usage not loaded) there is no box at all, not an empty one.
  host: { '[style.display]': "spend() ? null : 'none'" },
  template: `
    @if (spend(); as s) {
      <p>Respuestas de WhatsApp · {{ monthName() }}</p>
      <b>{{ count(s.service.sent) }} de {{ count(s.service.free) }} gratis</b>
      <div class="track" role="progressbar" [attr.aria-valuenow]="percent()" aria-valuemin="0" aria-valuemax="100">
        <i [style.width.%]="percent()" [class.over]="s.overFreeChannelIds.length > 0"></i>
      </div>
      @if (overLabel(); as label) {
        <small class="warn">{{ label }} · estimado {{ money(s.totalCents) }}</small>
      } @else if (s.totalCents > 0) {
        <small>Estimado a Meta este mes: {{ money(s.totalCents) }}</small>
      } @else {
        <small>1.000 gratis por número; después unos {{ price }} c/u</small>
      }
    }
  `,
  styles: `
    :host { display: block; background: var(--color-side-3); border: 1px solid var(--color-side-border);
      border-radius: var(--radius-md); padding: 11px 12px; }
    p { font-size: 12px; color: var(--color-side-muted); font-weight: 600; }
    b { display: block; font-size: 15px; color: #fff; margin: 3px 0 6px; }
    .track { height: 6px; background: var(--color-side-border); border-radius: var(--radius-pill); overflow: hidden; }
    .track i { display: block; height: 100%; background: var(--color-success); }
    .track i.over { background: var(--color-warning); }
    small { font-size: 11.5px; color: var(--color-side-muted); display: block; margin-top: 6px; }
    small.warn { color: #f6b48c; }
  `,
})
export class UsageMeter {
  private readonly workspace = inject(Workspace);

  protected readonly price = formatUnitPrice(META_RATES_USD.service);
  protected readonly spend = computed(() => {
    const rows = this.workspace.usage();
    return rows.length ? estimateSpend(rows) : null;
  });
  protected readonly percent = computed(() => {
    const service = this.spend()?.service;
    return service?.free ? Math.min(100, Math.round((service.sent / service.free) * 100)) : 0;
  });
  /** Which number already pays for its replies: the free tier is per number, so the total can hide it. */
  protected readonly overLabel = computed(() => {
    const over = this.spend()?.overFreeChannelIds ?? [];
    if (!over.length) return null;
    return over.length === 1
      ? `${this.workspace.channelById().get(over[0]!)?.label ?? 'Un número'} pasó sus 1.000 gratis`
      : `${over.length} números pasaron sus 1.000 gratis`;
  });

  protected readonly monthName = computed(() => {
    const month = this.workspace.usage()[0]?.month;
    return month ? formatMonthName(month) : '';
  });

  protected count(value: number): string {
    return formatCount(value);
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }
}
