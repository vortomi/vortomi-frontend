import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import type { ApiList, ApiUsageRow } from '../../shared/api/contract';
import { toUsage } from '../../shared/api/mappers';
import type { UsageMonth } from '../../shared/api/models';
import { type DayRange, daysOf } from '../reports/reports.rules';
import type { CompanyUsage } from './usage-company.rules';

export interface CompanyUsageRequest {
  tenantId: string;
  range: DayRange;
  comparison: DayRange;
  /** The month whose Meta spend is shown ("2026-11"). */
  month: string;
  /** Preview mode: the sample company's name and plan. */
  sample: { name: string; plan: string; city: string };
}

/**
 * One company's «Uso y salud» figures (mockup web-27): the period, the one it is compared with and
 * the month's Meta usage of its numbers. 'api' mode asks the server; the prototype draws a sample.
 */
@Injectable({ providedIn: 'root' })
export class UsageCompanyData {
  private readonly api = inject(ApiClient);
  private readonly preview = inject(API_CONFIG).mode !== 'api';

  readonly current = signal<CompanyUsage | null>(null);
  readonly previous = signal<CompanyUsage | null>(null);
  readonly usage = signal<UsageMonth[]>([]);
  readonly error = signal<string | null>(null);
  readonly loadedAt = signal<Date | null>(null);
  private latest = 0;

  async load(request: CompanyUsageRequest): Promise<void> {
    const ticket = ++this.latest;
    // Another company: nothing of the one before stays on screen while this one loads.
    if (this.current()?.tenant.id !== request.tenantId) this.current.set(null);
    try {
      const [current, previous, usage] = this.preview
        ? [sampleCompany(request.tenantId, request.range, request.sample), sampleCompany(request.tenantId, request.comparison, request.sample), sampleMonth(request.tenantId, request.month)]
        : await Promise.all([this.company(request.tenantId, request.range), this.company(request.tenantId, request.comparison), this.monthUsage(request.tenantId, request.month)]);
      if (ticket !== this.latest) return;
      this.current.set(current);
      this.previous.set(previous);
      this.usage.set(usage);
      this.error.set(null);
      this.loadedAt.set(new Date());
    } catch (error) {
      if (ticket === this.latest) this.error.set(toApiFailure(error).message);
    }
  }

  private company(tenantId: string, range: DayRange): Promise<CompanyUsage> {
    return this.api.get<CompanyUsage>(`platform/usage/companies/${encodeURIComponent(tenantId)}`, { from: range.from, to: range.to });
  }

  private async monthUsage(tenantId: string, month: string): Promise<UsageMonth[]> {
    const rows = (await this.api.get<ApiList<ApiUsageRow>>('platform/usage', { month })).items;
    return rows.filter((row) => row.tenantId === tenantId).map(toUsage);
  }
}

/** Preview mode: the month's Meta usage of the sample company's two numbers. */
function sampleMonth(tenantId: string, month: string): UsageMonth[] {
  return [
    { tenantId, channelAccountId: 'n1', month, totalMessages: 640, serviceMessages: 388, utilityMessages: 42, marketingMessages: 0, freeEntryMessages: 0 },
    { tenantId, channelAccountId: 'n2', month, totalMessages: 120, serviceMessages: 71, utilityMessages: 0, marketingMessages: 0, freeEntryMessages: 0 },
  ];
}

/** Preview mode: steady sample figures for one company. Never real data. */
function sampleCompany(tenantId: string, range: DayRange, sample: CompanyUsageRequest['sample']): CompanyUsage {
  const wave = (seed: number, peak: number) => Math.round(((Math.sin(seed * 1.3) + 1) / 2) * peak);
  const days = daysOf(range).map((date, i) => {
    const customers = wave(i + Number(date.slice(5, 7)), 30);
    return { date, fromCustomers: customers, automatic: Math.round(customers * 0.7), staff: Math.round(customers * 0.25), ownerApp: 0 };
  });
  const busy = [0, 0, 0, 0, 0, 0, 0, 1, 3, 8, 14, 22, 26, 18, 10, 12, 15, 11, 7, 4, 2, 1, 0, 0];
  return {
    from: range.from,
    to: range.to,
    tenant: { id: tenantId, name: sample.name, plan: sample.plan, status: 'active', city: sample.city, createdAt: '2026-08-12T15:00:00Z' },
    days,
    hours: busy.map((n, hour) => ({ hour, fromCustomers: n * 3, answers: Math.round(n * 2.8) })).filter((h) => h.fromCustomers),
    replies: { customerMessages: 412, unanswered: 6, medianSec: 38 },
    delivery: { outbound: 380, delivered: 377, failed: 3 },
    staffPeople: 3,
    agent: {
      settings: { enabled: true, schedule: 'always', humanPauseMinutes: 30 },
      months: [
        { month: '2026-09', replies: 241, inputTokens: 812_000, outputTokens: 26_400 },
        { month: '2026-10', replies: 288, inputTokens: 951_300, outputTokens: 30_900 },
      ],
    },
    numbers: [
      { id: 'n1', label: 'Ventas', displayNumber: '0412-555-0101', status: 'connected', statusReason: null, coexistence: true, tokenExpiresAt: '2026-12-20T15:00:00Z' },
      { id: 'n2', label: 'Taller', displayNumber: '0414-555-0102', status: 'disconnected', statusReason: 'inactive', coexistence: true, tokenExpiresAt: null },
    ],
    operation: {
      conversations: 214,
      open: 18,
      newConversations: 41,
      orders: [{ status: 'awaiting_payment', count: 4 }, { status: 'confirmed', count: 9 }, { status: 'done', count: 63 }],
      people: [{ role: 'admin', count: 1 }, { role: 'agent', count: 2 }],
      approvedTemplates: 3,
    },
  };
}
