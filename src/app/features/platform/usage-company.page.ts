import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../core/clock';
import { TENANT_PLAN, TENANT_STATUS } from '../../shared/api/labels';
import type { TenantPlan, TenantStatus } from '../../shared/api/models';
import { estimateSpend, FREE_SERVICE_PER_NUMBER } from '../../shared/billing/meta-pricing';
import { calendarDay, formatMonthName } from '../../shared/format/date-time';
import { formatCount, formatUsdCents } from '../../shared/format/money';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Skeleton } from '../../shared/ui/skeleton';
import { DailyChart, type PairSeries } from '../reports/daily-chart';
import { MetaSpendCard } from '../reports/meta-spend-card';
import { type ReportPeriod, comparisonRange, periodRange } from '../reports/reports.rules';
import { PlatformData } from './platform.data';
import { UsageCompanyData } from './usage-company.data';
import { agentRows, companyKpis, dayBars, durationText, hourBars, numberRows, operationRows, whoAnswers } from './usage-company.rules';
import { ago } from './usage-overview.rules';

const PLATFORM_ZONE = 'America/Caracas';
const REFRESH_MS = 60_000;
const DAYS: PairSeries = { caption: 'Mensajes por día', first: 'de clientes', second: 'respuestas' };
const HOURS: PairSeries = { caption: 'Mensajes por hora del día', first: 'de clientes', second: 'respuestas' };

/**
 * One company's «Uso y salud» (mockup web-27), opened from «Por empresa»: when its customers write,
 * who answers and how fast, its Meta spend, its agent, its numbers and its operation. Same pieces
 * as «Uso y salud» and the company's Reportes. Counts only: no conversation is read here.
 */
@Component({
  selector: 'app-usage-company-page',
  imports: [RouterLink, Avatar, Icon, Pill, Skeleton, DailyChart, MetaSpendCard],
  templateUrl: './usage-company.page.html',
  styleUrls: ['../reports/reports.page.scss', './usage.page.scss', './usage-company.page.scss'],
})
export class UsageCompanyPage {
  /** From the route: /platform/usage/:tenantId. */
  readonly tenantId = input.required<string>();

  private readonly clock = inject(Clock);
  private readonly platform = inject(PlatformData);
  protected readonly data = inject(UsageCompanyData);

  protected readonly period = signal<ReportPeriod>('month');
  private readonly tick = signal(0);

  private readonly today = computed(() => calendarDay(this.clock.now().toISOString(), PLATFORM_ZONE));
  private readonly range = computed(() => periodRange(this.period(), this.today()));
  protected readonly spendMonth = computed(() => (this.period() === 'previousMonth' ? this.range().from : this.today()).slice(0, 7));
  protected readonly periods = computed(() => {
    const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
    return [
      { id: 'last7' as const, label: '7 días' },
      { id: 'month' as const, label: capitalize(formatMonthName(this.today().slice(0, 7))) },
      { id: 'previousMonth' as const, label: capitalize(formatMonthName(periodRange('previousMonth', this.today()).from.slice(0, 7))) },
    ];
  });

  protected readonly days = DAYS;
  protected readonly hoursSeries = HOURS;
  protected readonly ready = computed(() => this.data.current()?.tenant.id === this.tenantId());
  private readonly usage = computed(() => this.data.current()!);
  protected readonly kpis = computed(() => companyKpis(this.usage(), this.data.previous()));
  protected readonly dayBars = computed(() => dayBars(this.usage(), this.range()));
  protected readonly hourBars = computed(() => hourBars(this.usage()));
  protected readonly who = computed(() => whoAnswers(this.usage()));
  protected readonly agent = computed(() => agentRows(this.usage()));
  protected readonly numbers = computed(() => numberRows(this.usage()));
  protected readonly operation = computed(() => operationRows(this.usage()));
  protected readonly spend = computed(() => estimateSpend(this.data.usage()));
  /** Free replies of the month: 1.000 per number, whether it wrote or not. */
  protected readonly freeReplies = computed(() => ({
    used: this.spend().service.sent,
    free: Math.max(1, this.usage().numbers.length) * FREE_SERVICE_PER_NUMBER,
  }));
  protected readonly header = computed(() => {
    const tenant = this.usage().tenant;
    const since = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: PLATFORM_ZONE }).format(new Date(tenant.createdAt)).replace('.', '');
    const status = TENANT_STATUS[tenant.status as TenantStatus] ?? { text: tenant.status, tone: 'neutral' as const };
    const plan = TENANT_PLAN[tenant.plan as TenantPlan]?.text ?? tenant.plan;
    return { name: tenant.name, status, detail: [plan, tenant.city, `en Vortomi desde el ${since}`].filter(Boolean).join(' · ') };
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
  protected readonly updated = computed(() => {
    this.tick();
    return ago(this.data.loadedAt()?.toISOString() ?? null, this.clock.now());
  });

  protected readonly count = formatCount;
  protected readonly money = formatUsdCents;
  protected readonly duration = durationText;
  protected readonly monthName = formatMonthName;

  constructor() {
    void this.platform.load();
    effect(() => {
      this.tick();
      const tenantId = this.tenantId();
      const row = this.platform.rows().find((r) => r.tenant.id === tenantId);
      const request = {
        tenantId,
        range: this.range(),
        comparison: comparisonRange(this.period(), this.today()),
        month: this.spendMonth(),
        sample: { name: row?.tenant.name ?? 'Empresa', plan: row?.tenant.plan ?? 'basic', city: row?.tenant.city ?? '' },
      };
      untracked(() => void this.data.load(request));
    });
    const timer = setInterval(() => this.tick.update((n) => n + 1), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
