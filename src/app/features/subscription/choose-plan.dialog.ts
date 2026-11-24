import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toApiFailure } from '../../core/api/api-error';
import type { SubscriptionView } from '../../shared/api/subscriptions';
import { formatUsdCents, formatVes } from '../../shared/format/money';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { SubscriptionData } from './subscription.data';
import { type CompanyPlan, PERIODS, type Period } from './subscription.models';
import { addDays, dayText, inBolivares, priceFor } from './subscription.rules';

/**
 * «Elegir el plan» (mockup web-38, frame 3): the company confirms the plan and how many months it
 * means to pay (1 by default; it may change them when it pays), sees the total in dollars and
 * bolívares, and when it has to pay by. The dialog itself is the confirmation.
 */
@Component({
  selector: 'app-choose-plan-dialog',
  imports: [Dialog, Icon],
  template: `
    @if (plan(); as p) {
      <app-dialog [open]="open()" [title]="'Elegir el plan ' + p.name" [locked]="saving()" (closed)="closed.emit()">
        <div class="mini">
          <div class="text"><b>{{ p.name }}</b>@if (p.description) { <span>{{ p.description }}</span> }</div>
          <p class="price">{{ money(p.priceCents) }} <small>/ mes</small></p>
        </div>

        <p class="label">¿Cuántos meses quieres pagar?</p>
        <div class="months" role="radiogroup" aria-label="Meses a pagar">
          @for (option of periods; track option) {
            @let price = priceOf(p, option);
            <button type="button" role="radio" [class.on]="months() === option" [attr.aria-checked]="months() === option" (click)="months.set(option)">
              <b>{{ option }} {{ option === 1 ? 'mes' : 'meses' }}</b>
              <small>{{ price.discountPercent ? '−' + price.discountPercent + ' %' : money(price.totalCents) }}</small>
            </button>
          }
        </div>

        @let total = priceOf(p, months());
        <div class="amounts">
          <div><p>Total</p><b>{{ money(total.totalCents) }}</b>@if (total.savedCents) { <small>Ahorras {{ money(total.savedCents) }}</small> }</div>
          <div>
            <p>En bolívares</p>
            @if (data.rate(); as rate) {
              <b>{{ bs(total.totalCents, rate.bsPerUsd) }}</b><small>tasa de Vortomi de hoy</small>
            } @else {
              <b class="none">—</b><small>Vortomi todavía no publica su tasa</small>
            }
          </div>
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
    .price { font-size: 20px; font-weight: 700; white-space: nowrap; }
    .price small { font-size: 12px; font-weight: 500; color: var(--color-text-muted); }
    .label { font-size: 13px; font-weight: 600; }
    .months { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .months button { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 8px 4px; border: 1px solid var(--color-border);
      border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); cursor: pointer; font: inherit; }
    .months button b { font-size: 13px; font-weight: 600; }
    .months button small { font-size: 12px; color: var(--color-text-muted); }
    .months button.on { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); background: var(--color-primary-softer); color: var(--color-primary-text); }
    .months button.on small { color: inherit; }
    .amounts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .amounts div { padding: 10px 14px; border-radius: var(--radius-md); background: var(--color-surface-hover); display: flex; flex-direction: column; gap: 2px; }
    .amounts p { font-size: 12.5px; color: var(--color-text-muted); }
    .amounts b { font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .amounts b.none { color: var(--color-text-muted); }
    .amounts small { font-size: 12px; color: var(--color-text-muted); }
    .note { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; line-height: 1.5; color: var(--color-text-muted); --icon-size: 15px; }
    .note app-icon { flex: none; margin-top: 2px; color: var(--color-info-text); }
    .note b { color: var(--color-text-2); font-weight: 600; }
    @media (max-width: 520px) {
      .months { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .amounts { grid-template-columns: 1fr; }
    }
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
  protected readonly periods = PERIODS;
  protected readonly months = signal<Period>(1);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** The first charge is due today: the last day to pay is 2 days later, the suspension 3. */
  protected readonly lastDay = computed(() => dayText(addDays(this.data.today(), 2)));
  protected readonly suspendDay = computed(() => dayText(addDays(this.data.today(), 3)));

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

  protected bs(cents: number, rate: string): string {
    return formatVes(inBolivares(cents, rate));
  }
}
