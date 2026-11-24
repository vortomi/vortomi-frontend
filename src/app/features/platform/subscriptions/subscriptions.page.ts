import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Clock } from '../../../core/clock';
import type { SubscriptionRow } from '../../../shared/api/subscriptions';
import { formatUsdCents } from '../../../shared/format/money';
import { Avatar } from '../../../shared/ui/avatar';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';
import { Skeleton } from '../../../shared/ui/skeleton';
import { PaymentMethodList } from '../../payment-methods/payment-method-list';
import { PAYMENT_METHODS_HOST } from '../../payment-methods/payment-methods.host';
import { PlanList } from '../plans/plan-list';
import { BillingSummary } from './billing-summary';
import { PaymentReviewList } from './payment-review-list';
import { PlatformPaymentReview } from './platform-payment-review';
import { STATE_FILTERS, type StateFilter, billingFigures, dayText, exemptionLine, matchesFilter, sortRows, stateLabel } from './billing.rules';
import { PlatformSubscriptions } from './platform-subscriptions';

type Tab = 'summary' | 'charges' | 'payments' | 'plans' | 'methods';
const TABS: Tab[] = ['summary', 'charges', 'payments', 'plans', 'methods'];
type SortKey = 'state' | 'paid' | 'last';

/** Caracas has no summer time: always UTC-4. */
const caracasToday = (now: Date) => new Date(now.getTime() - 4 * 3_600_000).toISOString().slice(0, 10);

/**
 * Console → Suscripciones (mockups web-32, web-37 and web-51): income and what is owed (Resumen),
 * what each company owes, has paid and who is up to date (Cobros), Vortomi's plans, and where
 * companies pay Vortomi. The console manages; it never
 * records payments (companies report theirs from their panel, stage 3). A row opens the company.
 */
@Component({
  selector: 'app-subscriptions-page',
  imports: [Avatar, BillingSummary, Icon, PaymentMethodList, PaymentReviewList, Pill, PlanList, RouterLink, Skeleton],
  templateUrl: './subscriptions.page.html',
  styleUrls: ['../platform-pages.scss', './subscriptions.page.scss'],
})
export class SubscriptionsPage {
  private readonly subscriptions = inject(PlatformSubscriptions);
  protected readonly methodsHost = inject(PAYMENT_METHODS_HOST);
  protected readonly review = inject(PlatformPaymentReview);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** From ?tab=, so coming back from the payment method editor lands on its tab. */
  protected readonly tab = signal<Tab>(this.tabFromUrl());
  protected readonly filter = signal<StateFilter>('all');
  protected readonly filters = STATE_FILTERS;

  protected readonly items = signal<SubscriptionRow[]>([]);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);

  /** Read once: the page is not left open across midnight for anything that matters here. */
  private readonly today = caracasToday(inject(Clock).now());

  protected readonly figures = computed(() => billingFigures(this.items()));
  /** Cobros sorts by state (the default), by the total paid or by the last payment, highest first. */
  protected readonly sort = signal<SortKey>('state');
  protected readonly rows = computed(() => {
    const rows = sortRows(this.items().filter((r) => matchesFilter(r, this.filter())));
    if (this.sort() === 'paid') return [...rows].sort((a, b) => b.paidTotalCents - a.paidTotalCents);
    if (this.sort() === 'last') return [...rows].sort((a, b) => (b.lastPaidOn ?? '').localeCompare(a.lastPaidOn ?? ''));
    return rows;
  });

  protected sortBy(key: SortKey): void {
    this.sort.set(this.sort() === key ? 'state' : key);
  }

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.failed.set(false);
    try {
      this.items.set(await this.subscriptions.list());
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }

  protected count(filter: StateFilter): number {
    return this.items().filter((r) => matchesFilter(r, filter)).length;
  }

  protected readonly exemptionLine = exemptionLine;

  protected state(row: SubscriptionRow) {
    return stateLabel(row, this.today);
  }

  protected date(day: string): string {
    return dayText(day);
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected open(row: SubscriptionRow): void {
    void this.router.navigate(['/platform/tenants', row.tenantId]);
  }

  /** Each tab keeps its place in the address (?tab=), without a new history step. */
  protected showTab(tab: Tab): void {
    this.tab.set(tab);
    void this.router.navigate([], { queryParams: { tab: tab === 'summary' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private tabFromUrl(): Tab {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    return TABS.find((t) => t === tab) ?? 'summary';
  }
}
