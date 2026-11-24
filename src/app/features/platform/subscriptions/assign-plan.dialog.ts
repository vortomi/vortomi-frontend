import { Component, type ElementRef, afterRenderEffect, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { toApiFailure } from '../../../core/api/api-error';
import { Clock } from '../../../core/clock';
import type { SubscriptionView } from '../../../shared/api/subscriptions';
import { formatUsdCents } from '../../../shared/format/money';
import { Confirm } from '../../../shared/ui/confirm';
import { Dialog } from '../../../shared/ui/dialog';
import { Icon } from '../../../shared/ui/icon';
import { Skeleton } from '../../../shared/ui/skeleton';
import { PlanCard } from '../plans/plan-card';
import { PERIOD_LABEL, type Plan } from '../plans/plan.models';
import { PlatformPlans } from '../plans/platform-plans';
import { dayText } from './billing.rules';
import { PlatformSubscriptions } from './platform-subscriptions';

const DAY_MS = 86_400_000;
/** The periods that can carry a discount (1 month never does). */
const DISCOUNT_PERIODS = ['3', '6', '12'] as const;
/** Space between the cards (matches .track's gap). */
const GAP = 14;

/**
 * «Asignar plan» from a company's page (mockup web-37, frame 2): Vortomi's active plans as the
 * company sees them in Suscripción → Planes, side by side (a carousel when they do not fit),
 * the chosen one marked, and below, what happens once it is assigned. The months are chosen by the
 * company when it pays. Asks before assigning: it starts the company's 3 days to pay.
 */
@Component({
  selector: 'app-assign-plan-dialog',
  imports: [Dialog, Icon, PlanCard, Skeleton],
  template: `
    <app-dialog [open]="open()" [title]="'Asignar plan a ' + tenantName()" [locked]="saving()" (closed)="closed.emit()">
      <div class="head">
        <p class="lead">Elige el plan. Los meses los elige la empresa cuando paga.</p>
        @if (carousel()) {
          <div class="arrows">
            <button type="button" class="icon-btn" aria-label="Planes anteriores" [disabled]="page() === 0" (click)="go(-1)"><app-icon name="back" /></button>
            <button type="button" class="icon-btn" aria-label="Más planes" [disabled]="page() >= pages() - 1" (click)="go(1)"><app-icon name="arrow" /></button>
          </div>
        }
      </div>
      @if (error(); as message) {
        <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
      }
      @if (!loaded()) {
        <app-skeleton kind="cards" [rows]="2" />
      } @else if (!plans().length) {
        <p class="form-alert warn"><app-icon name="info" />No hay planes activos. Créalos o actívalos en Suscripciones → Planes.</p>
      } @else {
        <div class="track" #track [class.single]="plans().length === 1" role="radiogroup" aria-label="Planes" (scroll)="onScroll()">
          @for (plan of plans(); track plan.id) {
            @let on = picked() === plan.id;
            <app-plan-card role="radio" tabindex="0" [attr.aria-checked]="on" [class.on]="on" (click)="picked.set(plan.id)"
              (keydown.enter)="picked.set(plan.id)" (keydown.space)="$event.preventDefault(); picked.set(plan.id)"
              [name]="plan.name" [priceCents]="plan.priceCents" [description]="plan.description" [benefits]="plan.benefits">
              <span plan-top class="spacer"></span>
              <span plan-top class="check" aria-hidden="true">@if (on) { <app-icon name="check" /> }</span>
              <div plan-foot class="tiers">
                @for (period of discountPeriods; track period) {
                  @if (plan.discounts[period]) { <span>{{ label[period] }} <b>−{{ plan.discounts[period] }} %</b></span> }
                }
                @if (!hasDiscounts(plan)) { <span class="none">Sin descuento por varios meses</span> }
              </div>
            </app-plan-card>
          }
        </div>
        @if (carousel()) {
          <div class="dots" aria-hidden="true">
            @for (dot of dots(); track dot) { <i [class.on]="dot === page()"></i> }
          </div>
        }

        <p class="note">
          <app-icon name="info" />
          @if (chosen(); as plan) {
            <span>Primer cobro: <b>{{ money(plan.priceCents) }}</b> por 1 mes. Tiene hasta el <b>{{ lastDay() }} a las 11:59 p. m.</b> para pagar; si no,
              el {{ suspendDay() }} se suspende. Su día de cobro será el de su primer pago, y lo verá en Suscripción.</span>
          } @else {
            <span>Al asignarlo, la empresa tiene 3 días para pagar su primer mes. Su día de cobro será el de su primer pago.</span>
          }
        </p>
      }
      <ng-container dialog-actions>
        <button type="button" class="btn" [disabled]="saving()" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="btn btn--primary" [disabled]="!chosen() || saving()" [attr.aria-busy]="saving()" (click)="assign()">Asignar plan</button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    :host { --dialog-width: 820px; }
    .head { display: flex; align-items: center; gap: 12px; }
    .lead { flex: 1; font-size: 13.5px; color: var(--color-text-muted); }
    .arrows { display: flex; gap: 6px; }
    .arrows .icon-btn { border: 1px solid var(--color-border); border-radius: 50%; width: 32px; height: 32px; display: grid; place-items: center; --icon-size: 16px; }
    .arrows .icon-btn:disabled { opacity: 0.4; cursor: default; }

    /* Two cards at a time; more slide sideways and stop on each card. */
    .track { display: flex; gap: 14px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none;
      padding: 4px 2px 6px; margin: -4px -2px 0; }
    .track::-webkit-scrollbar { display: none; }
    .track.single app-plan-card { flex-basis: 100%; }
    /* Tall, narrow cards like the company's Suscripción → Planes: three at a time. */
    app-plan-card { flex: 0 0 calc((100% - 28px) / 3); min-height: 340px; scroll-snap-align: start; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
    app-plan-card:hover { border-color: var(--color-border-strong, var(--color-text-faint)); }
    app-plan-card:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }
    app-plan-card.on { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface)); }
    .spacer { flex: 1; }
    .check { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--color-border); display: grid; place-items: center; flex: none; --icon-size: 14px; }
    app-plan-card.on .check { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
    .tiers { display: flex; flex-direction: column; gap: 4px; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--color-border); }
    .tiers span { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--color-text-2); }
    .tiers b { color: var(--color-success-text); font-weight: 700; }
    .tiers .none { color: var(--color-text-muted); }

    .dots { display: flex; justify-content: center; gap: 6px; }
    .dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--color-border); transition: width 0.2s; }
    .dots i.on { width: 18px; border-radius: 99px; background: var(--color-primary); }

    /* What assigning starts, as a short legend under the cards. */
    .note { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; line-height: 1.5; color: var(--color-text-muted); --icon-size: 15px; }
    .note app-icon { flex: none; margin-top: 2px; color: var(--color-info-text); }
    .note b { color: var(--color-text-2); font-weight: 600; }

    /* Phones: one card at a time, the next one peeking. */
    @media (max-width: 640px) {
      app-plan-card { flex-basis: 78%; }
    }
  `,
})
export class AssignPlanDialog {
  readonly open = input(false);
  readonly tenantId = input.required<string>();
  readonly tenantName = input.required<string>();
  readonly closed = output<void>();
  readonly assigned = output<SubscriptionView>();

  private readonly plansApi = inject(PlatformPlans);
  private readonly subscriptions = inject(PlatformSubscriptions);
  private readonly confirm = inject(Confirm);
  private readonly clock = inject(Clock);
  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  protected readonly discountPeriods = DISCOUNT_PERIODS;
  protected readonly label = PERIOD_LABEL;
  protected readonly plans = signal<Plan[]>([]);
  protected readonly loaded = signal(false);
  protected readonly picked = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The carousel's page: the first card in view. */
  protected readonly page = signal(0);
  /** Cards that fit at once: three on a wide screen, one on a phone. */
  private readonly perView = signal(3);

  protected readonly chosen = computed(() => this.plans().find((p) => p.id === this.picked()) ?? null);
  protected readonly carousel = computed(() => this.plans().length > this.perView());
  protected readonly pages = computed(() => Math.max(1, this.plans().length - this.perView() + 1));
  protected readonly dots = computed(() => Array.from({ length: this.pages() }, (_, i) => i));

  /** The first charge is due today (Caracas, UTC-4): the last day to pay is 2 days later, the suspension 3. */
  private readonly today = new Date(this.clock.now().getTime() - 4 * 3_600_000).toISOString().slice(0, 10);
  protected readonly lastDay = computed(() => this.dayFromToday(2));
  protected readonly suspendDay = computed(() => this.dayFromToday(3));

  constructor() {
    // How many cards fit, measured once they are on screen (and again on every scroll).
    afterRenderEffect(() => {
      this.plans();
      this.measure();
    });
    // Fresh plans each time it opens; with a single plan, it comes chosen.
    effect(() => {
      if (!this.open()) return;
      untracked(() => void this.load());
    });
  }

  protected hasDiscounts(plan: Plan): boolean {
    return DISCOUNT_PERIODS.some((p) => plan.discounts[p] > 0);
  }

  /** One card further or back. */
  protected go(step: number): void {
    const measured = this.measure();
    measured?.track.scrollBy({ left: step * measured.step });
  }

  protected onScroll(): void {
    const measured = this.measure();
    if (measured) this.page.set(Math.min(this.pages() - 1, Math.round(measured.track.scrollLeft / measured.step)));
  }

  /** The track, the width of one card plus its gap, and how many cards fit in view. */
  private measure(): { track: HTMLElement; step: number } | null {
    const track = this.track()?.nativeElement;
    const card = track?.querySelector('app-plan-card');
    if (!track || !(card instanceof HTMLElement) || !card.offsetWidth) return null;
    const step = card.offsetWidth + GAP;
    this.perView.set(Math.max(1, Math.floor((track.clientWidth + GAP) / step)));
    return { track, step };
  }

  protected async assign(): Promise<void> {
    const plan = this.chosen();
    if (!plan) return;
    const yes = await this.confirm.ask({
      title: `¿Asignar ${plan.name} a ${this.tenantName()}?`,
      message: `Su primer cobro de ${this.money(plan.priceCents)} vence hoy y tiene hasta el ${this.lastDay()} para pagar. Después no se cambia el plan desde aquí.`,
      confirmLabel: 'Asignar plan',
    });
    if (!yes) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      this.assigned.emit(await this.subscriptions.assign(this.tenantId(), plan.id));
    } catch (error) {
      this.error.set(toApiFailure(error).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  private async load(): Promise<void> {
    this.loaded.set(false);
    this.error.set(null);
    this.page.set(0);
    try {
      const active = (await this.plansApi.list()).filter((p) => p.isActive);
      this.plans.set(active);
      this.picked.set(active.length === 1 ? active[0]!.id : null);
    } catch (error) {
      this.error.set(toApiFailure(error).message);
    } finally {
      this.loaded.set(true);
    }
  }

  private dayFromToday(days: number): string {
    return dayText(new Date(Date.parse(`${this.today}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10));
  }
}
