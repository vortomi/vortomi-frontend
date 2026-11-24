import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../../core/clock';
import type { SubscriptionView } from '../../../shared/api/subscriptions';
import { formatUsdCents } from '../../../shared/format/money';
import { Pill } from '../../../shared/ui/pill';
import { Toaster } from '../../../shared/ui/toaster';
import { AssignPlanDialog } from './assign-plan.dialog';
import { dayText, stateLabel } from './billing.rules';
import { PlatformSubscriptions } from './platform-subscriptions';

/**
 * «Suscripción» on a company's page in the console (mockup web-37, frames 1 and 3): without a
 * plan, the way to assign one; with it, what it owes, until when, and its billing day.
 */
@Component({
  selector: 'app-tenant-subscription-box',
  imports: [AssignPlanDialog, Pill, RouterLink],
  template: `
    <h2>Suscripción<span class="spacer"></span>
      @if (loaded() && !failed()) {
        @let s = state();
        <app-pill [tone]="s.tone" [dot]="subscription() !== null">{{ s.text }}</app-pill>
      }
    </h2>
    @if (failed()) {
      <p class="muted">No pudimos leer su suscripción. <button type="button" class="link" (click)="load()">Reintentar</button></p>
    } @else if (!loaded()) {
      <p class="muted">Cargando…</p>
    } @else if (subscription(); as s) {
      <dl class="kv">
        <dt>Plan</dt><dd>{{ s.plan.name }} · {{ money(s.plan.priceCents) }} al mes</dd>
        <dt>Asignado</dt><dd>{{ assignedOn(s) }}</dd>
        @if (s.owedCents > 0) {
          <dt>Se suspende</dt><dd class="bad">{{ date(s.suspendsOn) }}, 00:00</dd>
        } @else {
          <dt>Próximo vencimiento</dt><dd>{{ date(s.nextDueOn) }}</dd>
        }
        <dt>Debe</dt><dd>{{ money(s.owedCents) }}</dd>
        <dt>Día de cobro</dt><dd>{{ s.billingDay === null ? 'Lo fija su primer pago' : 'Los ' + s.billingDay + ' de cada mes' }}</dd>
        <!-- Overpayments go to the company's wallet once payments exist (stage 3): none yet. -->
        <dt>Saldo a favor</dt><dd>{{ money(0) }}</dd>
      </dl>
      <a class="btn btn--sm" routerLink="/platform/subscriptions">Ver en Suscripciones</a>
    } @else {
      <div class="none">
        <p class="muted">Todavía no tiene plan: no se le cobra nada.</p>
        <button type="button" class="btn btn--primary btn--sm" (click)="assigning.set(true)">Asignar plan</button>
      </div>
    }
    <app-assign-plan-dialog [open]="assigning()" [tenantId]="tenantId()" [tenantName]="tenantName()" (closed)="assigning.set(false)" (assigned)="onAssigned($event)" />
  `,
  styles: `
    :host { display: block; padding: 18px 20px; }
    h2 { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; margin-bottom: 12px; }
    .spacer { flex: 1; }
    .muted { font-size: 13.5px; color: var(--color-text-muted); }
    .link { border: 0; background: none; padding: 0; color: var(--color-primary-text); cursor: pointer; font: inherit; text-decoration: underline; }
    .none { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 4px 0; }
    dl.kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 7px 14px; font-size: 13.5px; margin-bottom: 14px; }
    dt { color: var(--color-text-muted); }
    dd { text-align: right; font-variant-numeric: tabular-nums; }
    dd.bad { color: var(--color-danger-text); font-weight: 600; }
  `,
  host: { class: 'card' },
})
export class TenantSubscriptionBox {
  readonly tenantId = input.required<string>();
  readonly tenantName = input.required<string>();

  private readonly subscriptions = inject(PlatformSubscriptions);
  private readonly toaster = inject(Toaster);
  private readonly today = new Date(inject(Clock).now().getTime() - 4 * 3_600_000).toISOString().slice(0, 10);

  protected readonly subscription = signal<SubscriptionView | null>(null);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly assigning = signal(false);

  protected readonly state = computed(() => {
    const s = this.subscription();
    return stateLabel(s ? { state: s.state, nextDueOn: s.nextDueOn } : { state: 'none', nextDueOn: null }, this.today);
  });

  constructor() {
    effect(() => {
      this.tenantId();
      untracked(() => void this.load());
    });
  }

  protected async load(): Promise<void> {
    this.loaded.set(false);
    this.failed.set(false);
    try {
      this.subscription.set(await this.subscriptions.view(this.tenantId()));
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }

  protected onAssigned(view: SubscriptionView): void {
    this.subscription.set(view);
    this.assigning.set(false);
    this.toaster.show(`Plan ${view.plan.name} asignado. Tiene 3 días para pagar.`);
  }

  protected assignedOn(s: SubscriptionView): string {
    const day = new Date(Date.parse(s.assignedAt) - 4 * 3_600_000).toISOString().slice(0, 10);
    return dayText(day, true);
  }

  protected date(day: string): string {
    return dayText(day);
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }
}
