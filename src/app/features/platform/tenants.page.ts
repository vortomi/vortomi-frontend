import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BusinessTypes } from '../../core/business-types';
import { Clock } from '../../core/clock';
import { CHANNEL_STATUS, TENANT_PLAN, TENANT_STATUS } from '../../shared/api/labels';
import type { Tenant, TenantPlan } from '../../shared/api/models';
import { formatCount } from '../../shared/format/money';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import { Skeleton } from '../../shared/ui/skeleton';
import { MiniBars } from './activity-bars';
import { PlatformData, type TenantRow } from './platform.data';
import { TenantInsightsData } from './tenant-insights.data';
import {
  SORT_OPTIONS,
  STATUS_TABS,
  type SortKey,
  type StatusTab,
  isQuiet,
  matchesSearch,
  numbersSummary,
  percentChange,
  sortRows,
  sumOf,
  tabOf,
  timeAgo,
} from './tenant-list.rules';
import { UnclassifiedTypes } from './unclassified-types';

const PLAN_OPTIONS: MenuOption[] = [
  { value: 'all', label: 'Todos los planes' },
  ...(Object.entries(TENANT_PLAN) as [TenantPlan, { text: string }][]).map(([value, plan]) => ({ value, label: plan.text })),
];

/** Every company on the platform (mockup web-25, step 1): figures, filters and one rich row each. */
@Component({
  selector: 'app-tenants-page',
  imports: [RouterLink, Avatar, Icon, Pill, Skeleton, SelectMenu, MiniBars, UnclassifiedTypes],
  templateUrl: './tenants.page.html',
  styleUrl: './tenants.page.scss',
})
export class TenantsPage {
  protected readonly data = inject(PlatformData);
  protected readonly insights = inject(TenantInsightsData);
  private readonly router = inject(Router);
  private readonly businessTypes = inject(BusinessTypes);
  private readonly clock = inject(Clock);

  protected readonly labels = { status: TENANT_STATUS, plan: TENANT_PLAN, channel: CHANNEL_STATUS };
  protected readonly tabs = STATUS_TABS;
  protected readonly planOptions = PLAN_OPTIONS;
  protected readonly sortOptions: MenuOption[] = SORT_OPTIONS;
  protected readonly count = formatCount;

  protected readonly search = signal('');
  protected readonly tab = signal<StatusTab>('all');
  protected readonly plan = signal('all');
  protected readonly sort = signal<SortKey>('activity');

  constructor() {
    // 'api' mode: fresh every time the page opens; the figures load on their own.
    void this.data.load();
    void this.insights.loadList();
  }

  protected readonly now = computed(() => this.clock.now());

  protected readonly tabCounts = computed(() => {
    const counts = new Map<StatusTab, number>(STATUS_TABS.map((t) => [t.key, 0]));
    for (const row of this.data.rows()) {
      counts.set('all', counts.get('all')! + 1);
      const tab = tabOf(row.tenant.status);
      counts.set(tab, counts.get(tab)! + 1);
    }
    return counts;
  });

  protected readonly rows = computed(() => {
    const filtered = this.data
      .rows()
      .filter((r) => this.tab() === 'all' || tabOf(r.tenant.status) === this.tab())
      .filter((r) => this.plan() === 'all' || r.tenant.plan === this.plan())
      .filter((r) => matchesSearch(r, this.typeOf(r.tenant), this.search()));
    return sortRows(filtered, this.sort(), this.insights.byTenant());
  });

  /** The five figures on top (mockup web-25). */
  protected readonly figures = computed(() => {
    const rows = this.data.rows();
    const channels = rows.flatMap((r) => r.channels);
    const list = this.insights.list();
    const agents = (list?.items ?? []).filter((i) => i.agentEnabled).length;
    return {
      active: rows.filter((r) => r.tenant.status === 'active').length,
      onboarding: rows.filter((r) => ['draft', 'awaiting_channel', 'awaiting_owner'].includes(r.tenant.status)).length,
      suspended: rows.filter((r) => r.tenant.status === 'suspended').length,
      connected: channels.filter((c) => c.status === 'connected').length,
      numbers: channels.length,
      disconnected: channels.filter((c) => c.status === 'disconnected').length,
      monthMessages: list?.monthMessages ?? this.data.kpis().monthMessages,
      change: list ? percentChange(list.monthMessages, list.previousMonthMessages) : null,
      agentReplies: list?.agentRepliesMonth ?? null,
      agents,
      alerts: this.data.alerts().length,
      critical: this.data.criticalAlerts(),
    };
  });

  /** The companies with open alerts, for the strip above the table. */
  protected readonly alertNames = computed(() => {
    const ids = [...new Set(this.data.alerts().map((a) => a.tenantId).filter((id): id is string => !!id))];
    return ids.map((id) => this.data.row(id)?.tenant.name).filter((name): name is string => !!name);
  });

  /** "Repuestos y autopartes", or what it wrote under «Otro». */
  protected typeOf(tenant: Tenant): string {
    return this.businessTypes.labelOf(tenant.businessType, tenant.businessTypeOther);
  }

  protected numbers(row: TenantRow) {
    return numbersSummary(row, this.now());
  }

  protected insight(row: TenantRow) {
    return this.insights.byTenant().get(row.tenant.id) ?? null;
  }

  protected sum(values: number[]): number {
    return sumOf(values);
  }

  protected ago(iso: string): string {
    return timeAgo(iso, this.now());
  }

  protected quiet(row: TenantRow): boolean {
    return isQuiet(row.tenant, this.insight(row)?.lastActivityAt ?? null, this.now());
  }

  /** The agent's use of the month, warned from 90 %. */
  protected nearCap(replies: number): boolean {
    const cap = this.insights.list()?.agentCap ?? 0;
    return cap > 0 && replies >= cap * 0.9;
  }

  protected setupPercent(done: number): number {
    return Math.round((done / (this.insights.list()?.setupTotal ?? 6)) * 100);
  }

  protected open(row: TenantRow): void {
    const unfinished = row.tenant.status === 'draft' || row.tenant.status === 'awaiting_channel';
    void (unfinished
      ? this.router.navigate(['/platform/tenants/new'], { queryParams: { resume: row.tenant.id } })
      : this.router.navigate(['/platform/tenants', row.tenant.id]));
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected pickSort(value: string): void {
    this.sort.set(value as SortKey);
  }
}
