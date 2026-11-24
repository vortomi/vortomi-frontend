import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { SubscriptionData } from './subscription.data';
import { SubscriptionPayments } from './subscription-payments';
import { SubscriptionPlans } from './subscription-plans';
import { SubscriptionSummary } from './subscription-summary';

type Tab = 'summary' | 'plans' | 'payments';
const TABS: Tab[] = ['summary', 'plans', 'payments'];

/**
 * Suscripción (mockups web-35 and web-37): the company's plan, what it owes and until when
 * (Resumen), Vortomi's plans (Planes) and its payments (Pagos). Owner and admins only; it stays
 * open while the company is suspended for not paying: it is where it pays.
 */
@Component({
  selector: 'app-subscription-page',
  imports: [Icon, Skeleton, SubscriptionPayments, SubscriptionPlans, SubscriptionSummary],
  template: `
    <header class="page-top">
      <h1>Suscripción</h1>
      <span class="sub">Tu plan, tus pagos y lo que incluye</span>
    </header>
    <div class="page-body">
      <nav class="tabs-line" role="tablist" aria-label="Secciones de la suscripción">
        <button type="button" role="tab" [class.on]="tab() === 'summary'" [attr.aria-selected]="tab() === 'summary'" (click)="show('summary')">Resumen</button>
        <button type="button" role="tab" [class.on]="tab() === 'plans'" [attr.aria-selected]="tab() === 'plans'" (click)="show('plans')">Planes</button>
        <button type="button" role="tab" [class.on]="tab() === 'payments'" [attr.aria-selected]="tab() === 'payments'" (click)="show('payments')">Pagos</button>
      </nav>
      @switch (tab()) {
        @case ('plans') { <app-subscription-plans /> }
        @case ('payments') { <app-subscription-payments /> }
        @default {
          @if (data.failed()) {
            <div class="form-alert" role="alert"><app-icon name="alert" /><span class="grow">No pudimos cargar tu suscripción.</span>
              <button type="button" class="btn btn--sm" (click)="data.load()"><span>Reintentar</span></button></div>
          } @else if (!data.loaded()) {
            <app-skeleton kind="cards" [rows]="2" />
          } @else if (data.subscription(); as s) {
            <app-subscription-summary [subscription]="s" />
          } @else {
            <div class="card none">
              <app-icon name="calendar" />
              <h2>Todavía no tienes un plan</h2>
              <p>Cuando Vortomi te asigne tu plan, aquí verás cuánto pagar, hasta cuándo y lo que incluye. Mientras tanto, no se te cobra nada.</p>
            </div>
          }
        }
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .page-body { display: flex; flex-direction: column; gap: 16px; }
    .page-body > * { flex-shrink: 0; }
    .form-alert { align-items: center; }
    .grow { flex: 1; }
    .none { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 24px; text-align: center; --icon-size: 28px; }
    .none app-icon { color: var(--color-text-muted); }
    .none h2 { font-size: 16px; font-weight: 600; }
    .none p { max-width: 460px; font-size: 13.5px; color: var(--color-text-muted); line-height: 1.5; }
  `,
})
export class SubscriptionPage {
  protected readonly data = inject(SubscriptionData);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly tab = signal<Tab>(this.tabFromUrl());

  constructor() {
    // Fresh on every visit: a payment approved or a plan assigned shows at once.
    void this.data.load();
  }

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
