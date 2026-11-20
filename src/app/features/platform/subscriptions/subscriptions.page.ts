import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TENANT_PLAN } from '../../../shared/api/labels';
import { formatShortDate } from '../../../shared/format/date-time';
import { formatUsdCents } from '../../../shared/format/money';
import { Avatar } from '../../../shared/ui/avatar';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';
import { PaymentMethodList } from '../../payment-methods/payment-method-list';
import { PAYMENT_METHODS_HOST } from '../../payment-methods/payment-methods.host';
import type { PlanTerms, Subscription } from './subscription.models';
import { type StatusFilter, billingFigures, billingStatus, matchesFilter, statusLabel } from './subscription.rules';
import { SubscriptionsStore } from './subscriptions.store';

type Tab = 'charges' | 'plans' | 'methods';
const TABS: Tab[] = ['charges', 'plans', 'methods'];

/**
 * Console → Suscripciones (mockup web-32, option A: a fixed fee per plan). What each company pays
 * and who is up to date, the plans, and where companies pay Vortomi. The console manages; it never
 * records payments (companies report theirs from their panel, later). Charges and plans are sample
 * data until the billing model is decided; the payment methods are real (PaymentMethodList).
 */
@Component({
  selector: 'app-subscriptions-page',
  imports: [Avatar, Icon, PaymentMethodList, Pill, RouterLink],
  templateUrl: './subscriptions.page.html',
  styleUrls: ['../platform-pages.scss', './subscriptions.page.scss'],
})
export class SubscriptionsPage {
  protected readonly store = inject(SubscriptionsStore);
  protected readonly methodsHost = inject(PAYMENT_METHODS_HOST);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** From ?tab=, so coming back from the payment method editor lands on its tab. */
  protected readonly tab = signal<Tab>(this.tabFromUrl());
  protected readonly filter = signal<StatusFilter>('all');
  protected readonly planText = TENANT_PLAN;

  protected readonly filters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'paid', label: 'Al día' },
    { id: 'due_soon', label: 'Por vencer' },
    { id: 'overdue', label: 'Atrasadas' },
    { id: 'trial', label: 'En prueba' },
  ];

  /** Read once: the page is not left open across midnight for anything that matters here. */
  private readonly today = signal(this.store.today());

  protected readonly figures = computed(() => billingFigures(this.store.subscriptions(), this.store.plans(), this.today()));

  /** Overdue first, then the ones due soonest; the internal company last. */
  protected readonly rows = computed(() =>
    this.store
      .subscriptions()
      .filter((sub) => matchesFilter(billingStatus(sub, this.today()), this.filter()))
      .sort((a, b) => rank(a) - rank(b) || a.nextChargeOn.localeCompare(b.nextChargeOn)),
  );

  protected readonly planCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const sub of this.store.subscriptions()) counts.set(sub.plan, (counts.get(sub.plan) ?? 0) + 1);
    return counts;
  });

  protected count(filter: StatusFilter): number {
    return this.store.subscriptions().filter((sub) => matchesFilter(billingStatus(sub, this.today()), filter)).length;
  }

  protected status(sub: Subscription) {
    return statusLabel(sub, this.today());
  }

  protected fee(sub: Subscription): string {
    return sub.plan === 'internal' ? '—' : formatUsdCents(this.store.terms(sub.plan).priceCents);
  }

  /** The trial's end is its first charge; the internal company has none. */
  protected nextCharge(sub: Subscription): string {
    if (sub.plan === 'internal') return '—';
    return formatShortDate(`${sub.nextChargeOn}T12:00:00Z`, 'UTC');
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected price(plan: PlanTerms): string {
    return plan.priceCents ? formatUsdCents(plan.priceCents) : '0,00 $';
  }

  protected limit(value: number | null, one: string, many: string): string {
    if (value === null) return `${many.charAt(0).toUpperCase()}${many.slice(1)} sin límite`;
    return `${value} ${value === 1 ? one : many}`;
  }

  protected open(sub: Subscription): void {
    void this.router.navigate(['/platform/subscriptions', sub.id]);
  }

  /** Each tab keeps its place in the address (?tab=), without a new history step. */
  protected showTab(tab: Tab): void {
    this.tab.set(tab);
    void this.router.navigate([], { queryParams: { tab: tab === 'charges' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private tabFromUrl(): Tab {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    return TABS.find((t) => t === tab) ?? 'charges';
  }
}

function rank(sub: Subscription): number {
  if (sub.plan === 'internal') return 3;
  return sub.trialEndsOn ? 2 : 1;
}
