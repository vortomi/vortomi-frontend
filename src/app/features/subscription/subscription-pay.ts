import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SubscriptionView } from '../../shared/api/subscriptions';
import { formatUsdCents, formatVes } from '../../shared/format/money';
import { PERIODS, type Period } from './subscription.models';
import { amountToPay, inBolivares } from './subscription.rules';

/**
 * «Tu primer pago» / «Tu próximo pago» (mockup web-37, frame 5): with a charge, what it comes to
 * (its months were chosen with the plan and are not asked again), as a sum, in dollars and, at
 * Vortomi's rate, in bolívares, and «Reportar pago». With nothing owed, only «Adelantar pago»: the
 * months are chosen on Reportar pago.
 */
@Component({
  selector: 'app-subscription-pay',
  imports: [RouterLink],
  template: `
    @let s = subscription();
    @let pay = amount();
    @if (s.charge) {
      <section class="card box">
        <h3>{{ s.billingDay === null ? 'Tu primer pago' : 'Tu próximo pago' }}</h3>
        <p class="for">{{ months() }} {{ months() === 1 ? 'mes' : 'meses' }} del plan {{ s.plan.name }}</p>
        <!-- The plan's price first; the discount, and what was already paid, at the end (mockup web-50). -->
        <div class="sum">
          <p class="row base"><span>Precio del plan</span><span>{{ money(base()) }} / mes</span></p>
          <p class="row"><span>{{ months() }} {{ months() === 1 ? 'mes' : 'meses' }} × {{ money(base()) }}</span><span>{{ money(pay.totalCents + pay.savedCents) }}</span></p>
          @if (pay.savedCents) {
            <p class="row off"><span>Descuento −{{ pay.discountPercent }} %</span><span>−{{ money(pay.savedCents) }}</span></p>
          } @else {
            <p class="row none"><span>Sin descuento</span><span>—</span></p>
          }
          @if (s.charge?.paidCents; as paid) { <p class="row off"><span>Ya pagado</span><span>−{{ money(paid) }}</span></p> }
          <p class="row pay"><span>Total a pagar</span><b>{{ money(pay.dueCents) }}</b></p>
          @if (s.rate; as rate) {
            <p class="row bs"><span>En bolívares<small>tasa de Vortomi de hoy: {{ rateText(rate.bsPerUsd) }}</small></span><b>{{ bs(pay.dueCents, rate.bsPerUsd) }}</b></p>
          } @else {
            <p class="row bs"><span>En bolívares<small>Vortomi todavía no publica su tasa</small></span><b class="none">—</b></p>
          }
        </div>
        @if (s.inReview) {
          <button type="button" class="btn btn--block" disabled>Ya tienes un pago en revisión</button>
        } @else {
          <a class="btn btn--primary btn--block" routerLink="/subscription/pay">Reportar pago</a>
        }
      </section>
    } @else {
      <!-- Nothing owed: only the way to pay ahead; its months are chosen on Reportar pago. -->
      @if (s.inReview) {
        <button type="button" class="btn ahead" disabled>Ya tienes un pago en revisión</button>
      } @else {
        <a class="btn btn--primary ahead" routerLink="/subscription/pay">Adelantar pago</a>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; }
    .ahead { align-self: flex-end; }
    .box { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
    h3 { font-size: 15px; font-weight: 600; }
    .for { font-size: 13.5px; color: var(--color-text-muted); margin-top: -6px; }
    .sum { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md);
      font-variant-numeric: tabular-nums; }
    .row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 13.5px; color: var(--color-text-2); }
    .row.base { color: var(--color-text); }
    .row.off { color: var(--color-success-text); font-weight: 600; }
    .row.none { color: var(--color-text-faint); }
    .row.pay { padding-top: 8px; margin-top: 2px; border-top: 1px solid var(--color-border); font-size: 15px; font-weight: 700; color: var(--color-text); }
    .row.pay b { font-size: 20px; }
    .row.bs b { font-size: 15px; color: var(--color-text); }
    .row.bs b.none { color: var(--color-text-muted); }
    .row.bs small { display: block; font-size: 12px; color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionPay {
  readonly subscription = input.required<SubscriptionView>();
  /** The charge's months, chosen with the plan. */
  protected readonly months = computed<Period>(() => PERIODS.find((p) => p === this.subscription().charge?.months) ?? 1);

  protected readonly amount = computed(() => amountToPay(this.subscription(), this.months()));
  /** The monthly price the sum starts from: the charge's (fixed when it was made), or the plan's today. */
  protected readonly base = computed(() => this.subscription().charge?.basePriceCents ?? this.subscription().plan.priceCents);

  /** «410,55 Bs/$». */
  protected rateText(rate: string): string {
    return `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(rate))} Bs/$`;
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected bs(cents: number, rate: string): string {
    return formatVes(inBolivares(cents, rate));
  }
}
