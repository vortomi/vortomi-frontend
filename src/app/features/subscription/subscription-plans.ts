import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import type { SubscriptionView } from '../../shared/api/subscriptions';
import { formatUsdCents } from '../../shared/format/money';
import { Icon } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { ChoosePlanDialog } from './choose-plan.dialog';
import { type CompanyPlan, PERIODS, type Period } from './subscription.models';
import { SubscriptionData } from './subscription.data';
import { priceFor } from './subscription.rules';

/**
 * Suscripción → Planes (mockups web-35 and web-38): Vortomi's active plans, with what each costs
 * per month, in total and how much it saves for the months shown. A company without a plan chooses
 * one here itself; with a plan, its own is marked (changing it comes later).
 */
@Component({
  selector: 'app-subscription-plans',
  imports: [ChoosePlanDialog, Icon, Skeleton],
  template: `
    <div class="segmented" role="tablist" aria-label="Meses a pagar">
      @for (option of periods; track option) {
        <button type="button" role="tab" [class.on]="months() === option" [attr.aria-selected]="months() === option" (click)="months.set(option)">
          {{ option }} {{ option === 1 ? 'mes' : 'meses' }}@if (bestDiscount(option); as best) { <i>hasta −{{ best }} %</i> }
        </button>
      }
    </div>

    @if (data.plansFailed()) {
      <div class="form-alert" role="alert"><app-icon name="alert" /><span class="grow">No pudimos cargar los planes.</span>
        <button type="button" class="btn btn--sm" (click)="data.loadPlans()"><span>Reintentar</span></button></div>
    } @else if (!data.plansLoaded()) {
      <app-skeleton kind="cards" [rows]="3" />
    } @else if (!data.plans().length) {
      <div class="card"><p class="empty-state"><app-icon name="layers" />Todavía no hay planes para mostrar.</p></div>
    } @else {
      <div class="plans">
        @for (plan of data.plans(); track plan.id) {
          @let price = priceOf(plan);
          @let mine = plan.id === data.subscription()?.plan?.id;
          <article class="card plan" [class.mine]="mine">
            @if (mine) { <span class="mark">Tu plan</span> }
            <h3>{{ plan.name }}</h3>
            <!-- The plan's own price first; the discount is applied at the end of the sum, never hidden in it. -->
            <p class="monthly">{{ money(plan.priceCents) }} <small>/ mes</small></p>
            <dl class="sum">
              <dt>{{ months() }} {{ months() === 1 ? 'mes' : 'meses' }} × {{ money(plan.priceCents) }}</dt><dd>{{ money(price.totalCents + price.savedCents) }}</dd>
              @if (price.savedCents) {
                <dt class="off">Descuento −{{ price.discountPercent }} %</dt><dd class="off">−{{ money(price.savedCents) }}</dd>
              } @else {
                <dt class="none">Sin descuento</dt><dd class="none">—</dd>
              }
            </dl>
            <p class="pay"><span>Pagas</span><span>@if (price.savedCents) { <s>{{ money(price.totalCents + price.savedCents) }}</s> }<b>{{ money(price.totalCents) }}</b></span></p>
            @if (plan.description) { <p class="desc">{{ plan.description }}</p> }
            <ul>
              @for (benefit of plan.benefits; track $index) { <li><app-icon name="check" />{{ benefit }}</li> }
            </ul>
            @if (exemptForGood()) {
              <button type="button" class="btn btn--block" disabled>Tu cuenta está exonerada</button>
            } @else if (!data.subscription()) {
              <button type="button" class="btn btn--primary btn--block" [disabled]="!data.loaded()" (click)="picked.set(plan)">Elegir este plan</button>
            } @else {
              <button type="button" class="btn btn--block" disabled>{{ mine ? 'Es tu plan actual' : 'Cambiar de plan · pronto' }}</button>
            }
          </article>
        }
      </div>
      @if (exemptForGood()) {
        <p class="form-alert info"><app-icon name="info" />Vortomi te exoneró del pago: no necesitas elegir un plan.</p>
      } @else if (data.subscription()) {
        <p class="form-alert info"><app-icon name="info" />Para cambiar de plan, escríbenos a soporte.</p>
      }
    }
    <app-choose-plan-dialog [open]="!!picked()" [plan]="picked()" [initialMonths]="months()" (closed)="picked.set(null)" (chosen)="onChosen($event)" />
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .segmented { align-self: flex-start; max-width: 100%; overflow-x: auto; }
    .segmented i { font-style: normal; font-size: 11.5px; font-weight: 700; color: var(--color-success-text); margin-left: 4px; }
    .form-alert { align-items: center; }
    .grow { flex: 1; }
    .plans { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; align-items: stretch; }
    .plan { position: relative; padding: 18px 18px 16px; display: flex; flex-direction: column; gap: 6px; }
    .plan.mine { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
    .mark { position: absolute; top: -10px; left: 16px; padding: 1px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; background: var(--color-primary); color: var(--color-on-primary); }
    h3 { font-size: 16px; font-weight: 600; }
    .monthly { font-size: 26px; font-weight: 700; line-height: 1.2; }
    .monthly small { font-size: 13px; font-weight: 500; color: var(--color-text-muted); }
    .sum { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 0; padding: 10px 0 0; margin-top: 2px; border-top: 1px solid var(--color-border);
      font-size: 13px; color: var(--color-text-2); font-variant-numeric: tabular-nums; }
    .sum dd { text-align: right; padding-left: 12px; }
    .sum .off { color: var(--color-success-text); font-weight: 600; }
    .sum .none { color: var(--color-text-faint); }
    .pay { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-top: 8px; border-top: 1px dashed var(--color-border);
      font-size: 14.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .pay s { margin-right: 6px; font-size: 12.5px; font-weight: 500; color: var(--color-text-muted); }
    .desc { font-size: 13.5px; color: var(--color-text-2); line-height: 1.45; margin-top: 4px; }
    ul { list-style: none; display: flex; flex-direction: column; gap: 6px; margin: 6px 0 10px; font-size: 13.5px; color: var(--color-text-2); }
    li { display: flex; align-items: flex-start; gap: 8px; --icon-size: 15px; }
    li app-icon { color: var(--color-success); margin-top: 2px; flex: none; }
    .plan.mine .btn:disabled { opacity: 1; color: var(--color-primary-text); background: var(--color-primary-softer); border-color: transparent; }
    .plan > .btn { margin-top: auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionPlans {
  protected readonly data = inject(SubscriptionData);
  protected readonly periods = PERIODS;
  protected readonly months = signal<Period>(1);
  /** The plan whose «Elegir el plan» is open. */
  protected readonly picked = signal<CompanyPlan | null>(null);
  /** Exempt with no end: nothing to choose (the server refuses it too). */
  protected readonly exemptForGood = computed(() => this.data.exemption()?.endsOn === null);
  /** The company chose its plan: the page shows its summary. */
  readonly chosen = output<SubscriptionView>();

  /** «hasta −20 %» on each period: the best discount any plan gives for it. */
  private readonly best = computed(() => {
    const plans = this.data.plans();
    return new Map(PERIODS.map((p) => [p, Math.max(0, ...plans.map((plan) => priceFor(plan, p).discountPercent))]));
  });

  constructor() {
    void this.data.loadPlans();
  }

  protected onChosen(view: SubscriptionView): void {
    this.picked.set(null);
    this.chosen.emit(view);
  }

  protected bestDiscount(months: Period): number {
    return this.best().get(months) ?? 0;
  }

  protected priceOf(plan: CompanyPlan) {
    return priceFor(plan, this.months());
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }
}
