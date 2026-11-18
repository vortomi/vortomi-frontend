import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import type { ApiList, ApiUsageRow } from '../../shared/api/contract';
import { toUsage } from '../../shared/api/mappers';
import type { UsageMonth } from '../../shared/api/models';
import type { DayRange } from '../reports/reports.rules';
import type { UsageOverview } from './usage-overview.rules';
import { sampleOverview, sampleUsage } from './usage-overview.sample';

export interface UsageOverviewRequest {
  range: DayRange;
  comparison: DayRange;
  /** The month whose Meta spend is shown ("2026-11"). */
  month: string;
  /** Companies of the sample data (preview mode only). */
  sampleTenantIds: readonly string[];
}

/**
 * The console's «Uso y salud» figures (mockup web-26): the period, the one it is compared with and
 * the month's Meta usage. 'api' mode asks the server; the prototype draws sample figures.
 */
@Injectable({ providedIn: 'root' })
export class UsageOverviewData {
  private readonly api = inject(ApiClient);
  private readonly preview = inject(API_CONFIG).mode !== 'api';

  readonly current = signal<UsageOverview | null>(null);
  readonly previous = signal<UsageOverview | null>(null);
  readonly usage = signal<UsageMonth[]>([]);
  readonly error = signal<string | null>(null);
  /** When the figures on screen were read. */
  readonly loadedAt = signal<Date | null>(null);
  private latest = 0;

  async load(request: UsageOverviewRequest): Promise<void> {
    // Only the last request lands: switching periods quickly never shows an older answer.
    const ticket = ++this.latest;
    try {
      const [current, previous, usage] = this.preview
        ? [sampleOverview(request.range, request.sampleTenantIds), sampleOverview(request.comparison, request.sampleTenantIds), sampleUsage(request.month, request.sampleTenantIds)]
        : await Promise.all([this.overview(request.range), this.overview(request.comparison), this.monthUsage(request.month)]);
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

  private overview(range: DayRange): Promise<UsageOverview> {
    return this.api.get<UsageOverview>('platform/usage/overview', { from: range.from, to: range.to });
  }

  private async monthUsage(month: string): Promise<UsageMonth[]> {
    return (await this.api.get<ApiList<ApiUsageRow>>('platform/usage', { month })).items.map(toUsage);
  }
}
