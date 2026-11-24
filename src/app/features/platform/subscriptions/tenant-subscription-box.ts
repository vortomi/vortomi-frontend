import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../../core/clock';
import { toApiFailure } from '../../../core/api/api-error';
import type { ExemptionView, SubscriptionView } from '../../../shared/api/subscriptions';
import { formatUsdCents } from '../../../shared/format/money';
import { Dialog } from '../../../shared/ui/dialog';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';
import { Toaster } from '../../../shared/ui/toaster';
import { AssignPlanDialog } from './assign-plan.dialog';
import { addDays, dayText, exemptionReasonLabel, stateLabel } from './billing.rules';
import { ExemptCompanyDialog } from './exempt-company.dialog';
import { PlatformSubscriptions } from './platform-subscriptions';

/**
 * «Suscripción» on a company's page in the console (mockups web-37, web-38 and web-49): without a
 * plan, the way to assign one as an exception (companies choose their own); with it, who chose it,
 * what it owes, until when, and its billing day. «Exonerar del pago» either way; exempt, who
 * exempted it, why and until when, to change or remove.
 */
@Component({
  selector: 'app-tenant-subscription-box',
  imports: [AssignPlanDialog, Dialog, ExemptCompanyDialog, Icon, Pill, RouterLink],
  template: `
    <h2>Suscripción<span class="spacer"></span>
      @if (loaded() && !failed()) {
        @let s = state();
        <app-pill [tone]="s.tone" [dot]="subscription() !== null || exemption() !== null">{{ s.text }}</app-pill>
      }
    </h2>
    @if (failed()) {
      <p class="muted">No pudimos leer su suscripción. <button type="button" class="link" (click)="load()">Reintentar</button></p>
    } @else if (!loaded()) {
      <p class="muted">Cargando…</p>
    } @else if (exemption(); as e) {
      <dl class="kv">
        <dt>Motivo</dt><dd>{{ reasonLabel(e) }}</dd>
        <dt>Hasta</dt><dd>{{ e.endsOn ? date(e.endsOn, true) : 'Sin fecha de fin' }}</dd>
        <dt>Desde</dt><dd>{{ grantedOn(e) }}@if (e.grantedByName) { · {{ e.grantedByName }} }</dd>
        @if (e.forgivenCents > 0) { <dt>Se le perdonó</dt><dd>{{ money(e.forgivenCents) }}</dd> }
        @if (subscription(); as s) { <dt>Plan</dt><dd>{{ s.plan.name }} · desde el {{ date(s.nextDueOn, true) }}</dd> }
        @if (e.note) { <dt>Nota</dt><dd class="note">{{ e.note }}</dd> }
      </dl>
      <div class="acts">
        <button type="button" class="link" (click)="exempting.set(true)">Cambiar</button>
        <button type="button" class="link danger" (click)="removing.set(true)">Quitar exoneración</button>
      </div>
    } @else if (subscription(); as s) {
      <dl class="kv">
        <dt>Plan</dt><dd>{{ s.plan.name }} · {{ money(s.plan.priceCents) }} al mes</dd>
        <dt>{{ s.origin === 'company' ? 'Elegido' : 'Asignado' }}</dt><dd>{{ assignedOn(s) }} · {{ s.origin === 'company' ? 'por la empresa' : 'por Vortomi' }}</dd>
        @if (s.owedCents > 0) {
          <dt>Se suspende</dt><dd class="bad">{{ date(s.suspendsOn) }}, 00:00</dd>
        } @else {
          <dt>Próximo vencimiento</dt><dd>{{ date(s.nextDueOn) }}</dd>
        }
        <dt>Debe</dt><dd>{{ money(s.owedCents) }}</dd>
        <dt>Día de cobro</dt><dd>{{ s.billingDay === null ? 'Lo fija su primer pago' : 'Los ' + s.billingDay + ' de cada mes' }}</dd>
        <dt>Saldo a favor</dt><dd>{{ money(s.walletCents) }}</dd>
      </dl>
      <div class="acts">
        <a class="btn btn--sm" routerLink="/platform/subscriptions">Ver en Suscripciones</a>
        <button type="button" class="btn btn--sm" (click)="exempting.set(true)">Exonerar del pago</button>
      </div>
    } @else {
      <div class="none">
        <p class="muted">Todavía no tiene plan: no se le cobra nada.</p>
        <div class="acts center">
          <button type="button" class="btn btn--primary btn--sm" (click)="assigning.set(true)">Asignar plan</button>
          <button type="button" class="btn btn--sm" (click)="exempting.set(true)">Exonerar del pago</button>
        </div>
      </div>
    }
    <app-assign-plan-dialog [open]="assigning()" [tenantId]="tenantId()" [tenantName]="tenantName()" (closed)="assigning.set(false)" (assigned)="onAssigned($event)" />
    <app-exempt-company-dialog [open]="exempting()" [tenantId]="tenantId()" [tenantName]="tenantName()" [today]="today" [current]="exemption()"
      [owedCents]="subscription()?.owedCents ?? 0" (closed)="exempting.set(false)" (saved)="onExempted($event)" />
    <app-dialog [open]="removing()" [title]="'Quitar la exoneración de ' + tenantName()" [locked]="busy()" (closed)="removing.set(false)">
      <ul class="steps">
        <li><app-icon name="check" /><span>Termina en 7 días: su último día exonerado es el <b>{{ date(removeEnd(), true) }}</b>.</span></li>
        <li><app-icon name="check" /><span>Desde hoy verá el aviso para elegir y pagar su plan.</span></li>
        <li><app-icon name="check" /><span>El {{ date(removeAfter(), true) }} vuelve a las reglas de siempre.</span></li>
      </ul>
      <p class="hint"><app-icon name="info" />Los 7 días le dan el mismo aviso que una prueba gratis que termina. Para que termine otro día, usa «Cambiar» y elige la fecha.</p>
      @if (removeError(); as message) { <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div> }
      <ng-container dialog-actions>
        <button type="button" class="btn" [disabled]="busy()" (click)="removing.set(false)">Cancelar</button>
        <button type="button" class="btn btn--danger" [disabled]="busy()" [attr.aria-busy]="busy()" (click)="remove()">Quitar exoneración</button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    :host { display: block; padding: 18px 20px; }
    h2 { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; margin-bottom: 12px; }
    .spacer { flex: 1; }
    .muted { font-size: 13.5px; color: var(--color-text-muted); }
    .link { border: 0; background: none; padding: 0; color: var(--color-primary-text); cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 600; }
    .link.danger { color: var(--color-danger-text); }
    .none { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 4px 0; }
    .acts { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: flex-end; }
    .acts.center { justify-content: center; gap: 8px; }
    dl.kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 7px 14px; font-size: 13.5px; margin-bottom: 14px; }
    dt { color: var(--color-text-muted); }
    dd { text-align: right; font-variant-numeric: tabular-nums; }
    dd.bad { color: var(--color-danger-text); font-weight: 600; }
    dd.note { text-align: left; overflow-wrap: anywhere; color: var(--color-text-2); }
    .steps { list-style: none; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--radius-md);
      background: var(--color-surface-hover); font-size: 13px; color: var(--color-text-2); --icon-size: 15px; }
    .steps li { display: flex; gap: 8px; align-items: flex-start; line-height: 1.4; }
    .steps app-icon { flex: none; margin-top: 2px; color: var(--color-success); }
    .hint { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; line-height: 1.5; color: var(--color-text-muted); --icon-size: 15px; }
    .hint app-icon { flex: none; margin-top: 2px; }
  `,
  host: { class: 'card' },
})
export class TenantSubscriptionBox {
  readonly tenantId = input.required<string>();
  readonly tenantName = input.required<string>();

  private readonly subscriptions = inject(PlatformSubscriptions);
  private readonly toaster = inject(Toaster);
  protected readonly today = new Date(inject(Clock).now().getTime() - 4 * 3_600_000).toISOString().slice(0, 10);

  protected readonly subscription = signal<SubscriptionView | null>(null);
  protected readonly exemption = signal<ExemptionView | null>(null);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly assigning = signal(false);
  protected readonly exempting = signal(false);
  protected readonly removing = signal(false);
  protected readonly busy = signal(false);
  protected readonly removeError = signal<string | null>(null);

  protected readonly state = computed(() => {
    if (this.exemption()) return stateLabel({ state: 'exempt', nextDueOn: null }, this.today);
    const s = this.subscription();
    return stateLabel(s ? { state: s.state, nextDueOn: s.nextDueOn } : { state: 'none', nextDueOn: null }, this.today);
  });
  /** «Quitar exoneración» ends it 7 days from today (mockup web-49, frame 6). */
  protected readonly removeEnd = computed(() => addDays(this.today, 7));
  protected readonly removeAfter = computed(() => addDays(this.today, 8));

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
      const [subscription, exemption] = await Promise.all([this.subscriptions.view(this.tenantId()), this.subscriptions.exemption(this.tenantId())]);
      this.subscription.set(subscription);
      this.exemption.set(exemption);
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

  protected onExempted(view: ExemptionView): void {
    const changed = this.exemption() !== null;
    this.exemption.set(view);
    this.exempting.set(false);
    this.toaster.show(changed ? 'Exoneración actualizada.' : `${this.tenantName()} quedó exonerada del pago.`);
    // What it owed was forgiven: its subscription reads again.
    void this.subscriptions.view(this.tenantId()).then((s) => this.subscription.set(s), () => undefined);
  }

  protected async remove(): Promise<void> {
    this.busy.set(true);
    this.removeError.set(null);
    try {
      this.exemption.set(await this.subscriptions.removeExemption(this.tenantId()));
      this.removing.set(false);
      this.toaster.show(`La exoneración de ${this.tenantName()} termina el ${this.date(this.removeEnd(), true)}.`);
    } catch (error) {
      this.removeError.set(toApiFailure(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected reasonLabel(e: ExemptionView): string {
    return exemptionReasonLabel(e.reason);
  }

  protected grantedOn(e: ExemptionView): string {
    return this.date(new Date(Date.parse(e.grantedAt) - 4 * 3_600_000).toISOString().slice(0, 10), true);
  }

  protected assignedOn(s: SubscriptionView): string {
    const day = new Date(Date.parse(s.assignedAt) - 4 * 3_600_000).toISOString().slice(0, 10);
    return dayText(day, true);
  }

  protected date(day: string, year = false): string {
    return dayText(day, year);
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }
}
