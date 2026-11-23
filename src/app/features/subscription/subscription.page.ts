import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { SubscriptionData } from './subscription.data';
import { SubscriptionPayments } from './subscription-payments';
import { SubscriptionPlans } from './subscription-plans';
import { SubscriptionSummary } from './subscription-summary';

type Tab = 'summary' | 'plans' | 'payments';
const TABS: Tab[] = ['summary', 'plans', 'payments'];

/**
 * Suscripción (mockup web-35): the company's plan, its next payment and what it includes (Resumen),
 * Vortomi's plans (Planes) and its payments (Pagos). The company's own subscription is sample data
 * until companies are linked to plans; the screen says so. Owner and admins only.
 */
@Component({
  selector: 'app-subscription-page',
  imports: [Icon, SubscriptionPayments, SubscriptionPlans, SubscriptionSummary],
  template: `
    <header class="page-top">
      <h1>Suscripción</h1>
      <span class="sub">Tu plan, tus pagos y lo que incluye</span>
    </header>
    <div class="page-body">
      @if (data.isSample && tab() !== 'plans') {
        <p class="form-alert warn" role="note"><app-icon name="info" />
          <span><b>Vista previa.</b> Tu plan, sus fechas, tus pagos y el uso que ves aquí son de ejemplo: así se verá esta sección cuando tu suscripción esté activa en Vortomi.</span></p>
      }
      <nav class="tabs-line" role="tablist" aria-label="Secciones de la suscripción">
        <button type="button" role="tab" [class.on]="tab() === 'summary'" [attr.aria-selected]="tab() === 'summary'" (click)="show('summary')">Resumen</button>
        <button type="button" role="tab" [class.on]="tab() === 'plans'" [attr.aria-selected]="tab() === 'plans'" (click)="show('plans')">Planes</button>
        <button type="button" role="tab" [class.on]="tab() === 'payments'" [attr.aria-selected]="tab() === 'payments'" (click)="show('payments')">Pagos</button>
      </nav>
      @switch (tab()) {
        @case ('plans') { <app-subscription-plans /> }
        @case ('payments') { <app-subscription-payments /> }
        @default { <app-subscription-summary /> }
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .page-body { display: flex; flex-direction: column; gap: 16px; }
    .page-body > * { flex-shrink: 0; }
    .form-alert { align-items: flex-start; }
  `,
})
export class SubscriptionPage {
  protected readonly data = inject(SubscriptionData);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly tab = signal<Tab>(this.tabFromUrl());

  /** Each tab keeps its place in the address (?tab=), without a new history step. */
  protected show(tab: Tab): void {
    this.tab.set(tab);
    void this.router.navigate([], { queryParams: { tab: tab === 'summary' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private tabFromUrl(): Tab {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    return TABS.find((t) => t === tab) ?? 'summary';
  }
}
