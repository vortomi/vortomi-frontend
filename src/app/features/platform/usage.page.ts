import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../core/clock';
import { estimateSpend } from '../../shared/billing/meta-pricing';
import { calendarDay, formatMonthName } from '../../shared/format/date-time';
import { formatCount } from '../../shared/format/money';
import { Pill } from '../../shared/ui/pill';
import { Skeleton } from '../../shared/ui/skeleton';
import { DailyChart, type PairSeries } from '../reports/daily-chart';
import { MetaSpendCard } from '../reports/meta-spend-card';
import { type ReportPeriod, comparisonRange, periodRange } from '../reports/reports.rules';
import { PlatformData } from './platform.data';
import { UsageOverviewData } from './usage-overview.data';
import { ago, barsOf, companyRows, healthItems, kpisOf } from './usage-overview.rules';

/** The console counts in Venezuela's calendar, like the companies' reports. */
const PLATFORM_ZONE = 'America/Caracas';
/** The figures refresh by themselves while the page is open. */
const REFRESH_MS = 60_000;
const SERIES: PairSeries = { caption: 'Mensajes por día', first: 'de clientes', second: 'respuestas' };

/**
 * «Uso y salud» of the platform console (mockup web-26): every company's use of WhatsApp and the
 * platform's health, with the same pieces as the company's Reportes (period switch, KPIs, the
 * paired day bars, the Meta spend card). Counts only: no conversation is ever read here.
 */
@Component({
  selector: 'app-usage-page',
  imports: [RouterLink, Skeleton, Pill, DailyChart, MetaSpendCard],
  templateUrl: './usage.page.html',
  styleUrls: ['../reports/reports.page.scss', './usage.page.scss'],
})
export class UsagePage {
  private readonly clock = inject(Clock);
  private readonly platform = inject(PlatformData);
  protected readonly data = inject(UsageOverviewData);

  protected readonly period = signal<ReportPeriod>('month');
  /** Re-read every minute so «actualizado hace…» and the health stay true. */
  private readonly tick = signal(0);

  private readonly today = computed(() => calendarDay(this.clock.now().toISOString(), PLATFORM_ZONE));
  private readonly range = computed(() => periodRange(this.period(), this.today()));
  /** Meta bills by month: the month shown, or the current one for «7 días». */
  protected readonly spendMonth = computed(() => (this.period() === 'previousMonth' ? this.range().from : this.today()).slice(0, 7));

  protected readonly periods = computed(() => {
    const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
    return [
      { id: 'last7' as const, label: '7 días' },
      { id: 'month' as const, label: capitalize(formatMonthName(this.today().slice(0, 7))) },
      { id: 'previousMonth' as const, label: capitalize(formatMonthName(periodRange('previousMonth', this.today()).from.slice(0, 7))) },
    ];
  });

  protected readonly series = SERIES;
  protected readonly ready = computed(() => this.data.current() !== null);
  protected readonly kpis = computed(() => kpisOf(this.data.current()!, this.data.previous()));
  protected readonly bars = computed(() => barsOf(this.data.current()!, this.range()));
  protected readonly spend = computed(() => estimateSpend(this.data.usage()));
  protected readonly companies = computed(() => {
    const names = new Map(this.platform.rows().map((row) => [row.tenant.id, row.tenant.name]));
    return companyRows(this.data.current()!, this.data.usage(), names);
  });
  protected readonly health = computed(() => {
    this.tick();
    return healthItems(this.data.current()!, this.clock.now());
  });
  protected readonly companiesNow = computed(() => this.data.current()!.health.companies);
  protected readonly updated = computed(() => {
    this.tick();
    return ago(this.data.loadedAt()?.toISOString() ?? null, this.clock.now());
  });

  protected readonly comparedTo = computed(() => {
    switch (this.period()) {
      case 'last7':
        return 'los 7 días anteriores';
      case 'month':
        return `los mismos días de ${formatMonthName(periodRange('previousMonth', this.today()).from.slice(0, 7))}`;
      case 'previousMonth':
        return 'el mes anterior';
    }
  });

  protected readonly count = formatCount;
  protected readonly monthName = formatMonthName;

  constructor() {
    void this.platform.load();
    // A new period (or the minute's refresh) reads the figures again.
    effect(() => {
      this.tick();
      const range = this.range();
      const request = {
        range,
        comparison: comparisonRange(this.period(), this.today()),
        month: this.spendMonth(),
        sampleTenantIds: this.platform.rows().map((row) => row.tenant.id),
      };
      untracked(() => void this.data.load(request));
    });
    const timer = setInterval(() => this.tick.update((n) => n + 1), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected percentText(value: number | null): string {
    return value === null ? '—' : `${value} %`;
  }
}
