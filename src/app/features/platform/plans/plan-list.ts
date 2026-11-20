import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toApiFailure } from '../../../core/api/api-error';
import { Confirm } from '../../../shared/ui/confirm';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';
import { RowMenu } from '../../../shared/ui/row-menu';
import { Skeleton } from '../../../shared/ui/skeleton';
import { Switch } from '../../../shared/ui/switch';
import { Toaster } from '../../../shared/ui/toaster';
import type { Plan } from './plan.models';
import { companiesText } from './plan.rules';
import { PlanCard } from './plan-card';
import { PlatformPlans } from './platform-plans';

/** How long the card just saved stays highlighted. */
const HIGHLIGHT_MS = 2500;

/**
 * Suscripciones → Planes (mockup web-34, step 1): a card per plan with its switch (suspend), how
 * many companies are on it, «Editar» and ⋯ → «Eliminar» (only when no company has it).
 */
@Component({
  selector: 'app-plan-list',
  imports: [Icon, Pill, PlanCard, RouterLink, RowMenu, Skeleton, Switch],
  template: `
    <p class="form-alert info note">
      <app-icon name="info" />
      <span>Las empresas todavía <b>no ven</b> estos planes. El interruptor <b>suspende</b> un plan: se oculta y nadie nuevo lo elige; las empresas que ya lo tienen siguen igual.</span>
    </p>
    @if (failed()) {
      <div class="form-alert" role="alert">
        <app-icon name="alert" /><span class="grow">No pudimos cargar los planes.</span>
        <button type="button" class="btn btn--sm" [attr.aria-busy]="retrying()" (click)="retry()"><span>Reintentar</span></button>
      </div>
    } @else if (!loaded()) {
      <app-skeleton kind="cards" [rows]="3" />
    } @else {
      <div class="grid">
        @for (plan of plans(); track plan.id) {
          <app-plan-card [name]="plan.name" [priceCents]="plan.priceCents" [description]="plan.description" [benefits]="plan.benefits"
            [suspended]="!plan.isActive" [class.saved]="highlighted() === plan.id">
            <span plan-top class="state">
              @if (!plan.isActive) { <app-pill tone="neutral">Suspendido</app-pill> }
              <app-switch [checked]="plan.isActive" [label]="(plan.isActive ? 'Suspender ' : 'Activar ') + plan.name" [busy]="busy() === plan.id"
                [disabled]="!!busy() && busy() !== plan.id" (toggled)="setActive(plan, $event)" />
              @if (plan.isActive) { <span class="on">Activo</span> }
            </span>
            <footer plan-foot>
              <span>{{ plan.isActive || !plan.companies ? companiesText(plan.companies) : companiesText(plan.companies) + ' lo siguen usando' }}</span>
              <span class="spacer"></span>
              <a class="btn btn--sm" [routerLink]="['/platform/subscriptions/plans', plan.id]"><app-icon name="edit" /><span>Editar</span></a>
              <app-row-menu [label]="'Más acciones sobre ' + plan.name">
                <button type="button" role="menuitem" class="danger" [disabled]="plan.companies > 0" (click)="remove(plan)">
                  <b>Eliminar</b>
                  <small>{{ plan.companies > 0 ? 'No se puede: ' + companiesText(plan.companies).toLowerCase() + ' lo tienen. Suspéndelo para que nadie más lo elija.' : 'Ninguna empresa lo tiene.' }}</small>
                </button>
              </app-row-menu>
            </footer>
          </app-plan-card>
        }
        <a class="card add" routerLink="/platform/subscriptions/plans/new">
          <span class="plus"><app-icon name="plus" /></span>
          <b>Nuevo plan</b>
          <span>Nombre, precio, descuentos y beneficios</span>
        </a>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .note { margin-bottom: 16px; }
    .form-alert { align-items: center; }
    .grow { flex: 1; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; align-items: start; }
    app-plan-card { transition: box-shadow 0.2s; }
    app-plan-card.saved { box-shadow: 0 0 0 3px var(--color-success); }
    .state { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--color-text-muted); }
    footer { display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--color-border-soft); padding-top: 10px; font-size: 12.5px;
      color: var(--color-text-muted); }
    .spacer { flex: 1; }
    .add { border-style: dashed; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 24px; min-height: 200px;
      color: var(--color-text-muted); text-decoration: none; font-size: 13px; text-align: center; }
    .add b { color: var(--color-text); font-size: 14px; }
    .add:hover { border-color: var(--color-primary); color: var(--color-primary-text); background: var(--color-primary-softer); }
    .plus { width: 40px; height: 40px; border-radius: 50%; background: var(--color-surface-hover); display: flex; align-items: center; justify-content: center; --icon-size: 18px; }
  `,
})
export class PlanList {
  private readonly remote = inject(PlatformPlans);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly companiesText = companiesText;
  protected readonly plans = signal<Plan[]>([]);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly retrying = signal(false);
  /** The plan whose switch is being saved: it waits, the others stay still. */
  protected readonly busy = signal<string | null>(null);
  protected readonly highlighted = signal<string | null>(null);

  constructor() {
    void this.load();
    this.highlightSaved();
  }

  protected async load(): Promise<void> {
    this.failed.set(false);
    try {
      this.plans.set(await this.remote.list());
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }

  protected async retry(): Promise<void> {
    this.retrying.set(true);
    await this.load();
    this.retrying.set(false);
  }

  /** Suspending asks first (mockup step 5); activating again does not. */
  protected async setActive(plan: Plan, isActive: boolean): Promise<void> {
    if (this.busy()) return;
    if (!isActive) {
      const kept = plan.companies ? `Las ${companiesText(plan.companies).toLowerCase()} que ya lo tienen siguen funcionando con este plan. ` : '';
      const yes = await this.confirm.ask({
        title: `¿Suspender el plan ${plan.name}?`,
        message: `Queda oculto: ninguna empresa lo verá ni podrá elegirlo. ${kept}Puedes volver a activarlo cuando quieras con el mismo interruptor.`,
        confirmLabel: 'Sí, suspender',
      });
      if (!yes) return;
    }
    this.busy.set(plan.id);
    try {
      const saved = await this.remote.setActive(plan.id, isActive);
      this.plans.update((list) => list.map((p) => (p.id === saved.id ? saved : p)));
      this.toaster.show(isActive ? `${plan.name} está activo otra vez.` : `${plan.name} quedó suspendido.`);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.busy.set(null);
    }
  }

  protected async remove(plan: Plan): Promise<void> {
    if (plan.companies > 0) return;
    const yes = await this.confirm.ask({
      title: `¿Eliminar el plan ${plan.name}?`,
      message: 'Ninguna empresa lo tiene. Se borra del todo y no se puede deshacer.',
      confirmLabel: 'Sí, eliminar',
      danger: true,
      action: () => this.remote.remove(plan.id),
    });
    if (!yes) return;
    this.plans.update((list) => list.filter((p) => p.id !== plan.id));
    this.toaster.show(`${plan.name} se eliminó.`);
  }

  /** Back from the editor with ?saved=<id>: that card shines for a moment. The tab stays in the address. */
  private highlightSaved(): void {
    const saved = this.route.snapshot.queryParamMap.get('saved');
    if (!saved) return;
    this.highlighted.set(saved);
    void this.router.navigate([], { queryParams: { saved: null }, queryParamsHandling: 'merge', replaceUrl: true });
    setTimeout(() => this.highlighted.set(null), HIGHLIGHT_MS);
  }
}
