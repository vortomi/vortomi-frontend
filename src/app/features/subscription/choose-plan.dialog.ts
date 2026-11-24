import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toApiFailure } from '../../core/api/api-error';
import type { SubscriptionView } from '../../shared/api/subscriptions';
import { formatUsdCents, formatVes } from '../../shared/format/money';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { SubscriptionData } from './subscription.data';
import type { CompanyPlan, Period } from './subscription.models';
import { addDays, dayText, inBolivares, priceFor } from './subscription.rules';

/**
 * «Elegir el plan» (mockups web-38 and web-50): the company confirms the plan for the months it
 * chose on Planes (it may change them when it pays). The price reads as a sum, the discount applied
 * at the end: the plan's price, months × price, the discount, what it pays, and in bolívares; then
 * when it has to pay by. The dialog itself is the confirmation.
 */
@Component({
  selector: 'app-choose-plan-dialog',
  imports: [Dialog, Icon],
  template: `
    @if (plan(); as p) {
      <app-dialog [open]="open()" [title]="'Elegir el plan ' + p.name" [locked]="saving()" (closed)="closed.emit()">
        @let total = priceOf(p, months());
        <div class="mini">
          <div class="text"><b>{{ p.name }}</b>@if (p.description) { <span>{{ p.description }}</span> }</div>
          <span class="chip">{{ months() }} {{ months() === 1 ? 'mes' : 'meses' }}</span>
        </div>

        <div class="sum">
          <p class="row base"><span>Precio del plan</span><span>{{ money(p.priceCents) }} / mes</span></p>
          <p class="row"><span>{{ months() }} {{ months() === 1 ? 'mes' : 'meses' }} × {{ money(p.priceCents) }}</span><span>{{ money(total.totalCents + total.savedCents) }}</span></p>
          @if (total.savedCents) {
            <p class="row off"><span>Descuento −{{ total.discountPercent }} %</span><span>−{{ money(total.savedCents) }}</span></p>
          } @else {
            <p class="row none"><span>Sin descuento</span><span>—</span></p>
          }
          <p class="row pay"><span>Total a pagar</span><b>{{ money(total.totalCents) }}</b></p>
          @if (data.rate(); as rate) {
            <p class="row bs"><span>En bolívares<small>tasa de Vortomi de hoy: {{ rateText(rate.bsPerUsd) }}</small></span><b>{{ bs(total.totalCents, rate.bsPerUsd) }}</b></p>
          } @else {
            <p class="row bs"><span>En bolívares<small>Vortomi todavía no publica su tasa</small></span><b class="none">—</b></p>
          }
        </div>

        @if (error(); as message) {
          <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
        }
        <p class="note"><app-icon name="info" />
          <span>Tienes hasta el <b>{{ lastDay() }} a las 11:59 p. m.</b> para pagar; si no, el {{ suspendDay() }} tu cuenta se suspende. Tu día de cobro
            será el de tu primer pago. Puedes cambiar los meses al pagar.</span></p>

        <ng-container dialog-actions>
          <button type="button" class="btn" [disabled]="saving()" (click)="closed.emit()">Cancelar</button>
          <button type="button" class="btn btn--primary" [disabled]="saving()" [attr.aria-busy]="saving()" (click)="choose(p)">Elegir plan</button>
        </ng-container>
      </app-dialog>
    }
  `,
  styles: `
    :host { --dialog-width: 480px; }
    .mini { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 2px solid var(--color-primary); border-radius: var(--radius-lg); }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .text b { font-size: 15px; }
    .text span { font-size: 12.5px; color: var(--color-text-muted); line-height: 1.4; }
    .chip { flex: none; padding: 3px 12px; border-radius: 99px; font-size: 12.5px; font-weight: 700; background: var(--color-primary-softer); color: var(--color-primary-text); }
    .sum { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-lg);
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
    .note { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; line-height: 1.5; color: var(--color-text-muted); --icon-size: 15px; }
    .note app-icon { flex: none; margin-top: 2px; color: var(--color-info-text); }
    .note b { color: var(--color-text-2); font-weight: 600; }
  `,
})
export class ChoosePlanDialog {
  readonly open = input(false);
  readonly plan = input<CompanyPlan | null>(null);
  /** The months shown on Planes when the plan was picked: the starting choice. */
  readonly initialMonths = input<Period>(1);
  readonly closed = output<void>();
  readonly chosen = output<SubscriptionView>();

  protected readonly data = inject(SubscriptionData);
  protected readonly months = signal<Period>(1);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /**
   * The first charge is due today (for a company exempt until a day, the day after it): the last
   * day to pay is 2 days later, the suspension 3.
   */
  private readonly firstDue = computed(() => {
    const endsOn = this.data.exemption()?.endsOn;
    return endsOn ? addDays(endsOn, 1) : this.data.today();
  });
  protected readonly lastDay = computed(() => dayText(addDays(this.firstDue(), 2)));
  protected readonly suspendDay = computed(() => dayText(addDays(this.firstDue(), 3)));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const months = this.initialMonths();
      untracked(() => {
        this.months.set(months);
        this.error.set(null);
      });
    });
  }

  protected async choose(plan: CompanyPlan): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      this.chosen.emit(await this.data.choose(plan, this.months()));
    } catch (error) {
      this.error.set(toApiFailure(error).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected priceOf(plan: CompanyPlan, months: Period) {
    return priceFor(plan, months);
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  /** «410,55 Bs/$». */
  protected rateText(rate: string): string {
    return `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(rate))} Bs/$`;
  }

  protected bs(cents: number, rate: string): string {
    return formatVes(inBolivares(cents, rate));
  }
}
