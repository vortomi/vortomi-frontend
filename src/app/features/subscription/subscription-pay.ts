import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import type { SubscriptionView } from '../../shared/api/subscriptions';
import { formatUsdCents, formatVes } from '../../shared/format/money';
import { PERIODS, type Period } from './subscription.models';
import { amountToPay, inBolivares, priceFor } from './subscription.rules';

/**
 * «Tu primer pago» (mockup web-37, frame 5): the company chooses how many months it pays (1 by
 * default), and sees the amount in dollars and, at Vortomi's rate, in bolívares. Reporting the
 * payment comes in stage 3 (documentations/18): the button is there, still off.
 */
@Component({
  selector: 'app-subscription-pay',
  template: `
    @let s = subscription();
    @let pay = amount();
    <section class="card box">
      <h3>{{ s.billingDay === null ? 'Tu primer pago' : 'Tu próximo pago' }}</h3>
      <div class="months" role="radiogroup" aria-label="Meses a pagar">
        @for (option of periods; track option) {
          @let price = priceOf(option);
          <button type="button" role="radio" [class.on]="months() === option" [attr.aria-checked]="months() === option" (click)="months.set(option)">
            <b>{{ option }} {{ option === 1 ? 'mes' : 'meses' }}</b>
            <small>{{ option === 1 ? money(price.totalCents) : price.discountPercent ? '−' + price.discountPercent + ' %' : money(price.totalCents) }}</small>
          </button>
        }
      </div>
      <div class="amounts">
        <div><p>En dólares</p><b>{{ money(pay.dueCents) }}</b>@if (pay.savedCents) { <small>Ahorras {{ money(pay.savedCents) }}</small> }</div>
        <div>
          <p>En bolívares</p>
          @if (s.rate; as rate) {
            <b>{{ bs(pay.dueCents, rate.bsPerUsd) }}</b><small>tasa de Vortomi de hoy</small>
          } @else {
            <b class="none">—</b><small>Vortomi todavía no publica su tasa</small>
          }
        </div>
      </div>
      <button type="button" class="btn btn--block" disabled>Reportar pago · disponible pronto</button>
    </section>
  `,
  styles: `
    .box { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
    h3 { font-size: 15px; font-weight: 600; }
    .months { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .months button { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 8px 4px; border: 1px solid var(--color-border);
      border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); cursor: pointer; font: inherit; }
    .months button b { font-size: 13.5px; font-weight: 600; }
    .months button small { font-size: 12px; color: var(--color-text-muted); }
    .months button.on { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); background: var(--color-primary-softer); color: var(--color-primary-text); }
    .months button.on small { color: inherit; }
    .amounts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .amounts div { padding: 10px 14px; border-radius: var(--radius-md); background: var(--color-surface-hover); display: flex; flex-direction: column; gap: 2px; }
    .amounts p { font-size: 12.5px; color: var(--color-text-muted); }
    .amounts b { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .amounts b.none { color: var(--color-text-muted); }
    .amounts small { font-size: 12px; color: var(--color-text-muted); }
    @media (max-width: 600px) {
      .months { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .amounts { grid-template-columns: 1fr; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionPay {
  readonly subscription = input.required<SubscriptionView>();
  protected readonly periods = PERIODS;
  /** Starts at the months the company chose with its plan (1 by default); it may change them here. */
  protected readonly months = linkedSignal<Period>(() => PERIODS.find((p) => p === this.subscription().charge?.months) ?? 1);

  protected readonly amount = computed(() => amountToPay(this.subscription(), this.months()));

  protected priceOf(months: Period) {
    const s = this.subscription();
    return priceFor(s.charge ? { priceCents: s.charge.basePriceCents, discounts: s.charge.discounts } : s.plan, months);
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected bs(cents: number, rate: string): string {
    return formatVes(inBolivares(cents, rate));
  }
}
