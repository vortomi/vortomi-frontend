import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ApiClient } from '../../core/api/api-client';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { ApiList } from '../../shared/api/contract';
import type { ReportDay } from '../../shared/api/models';
import { allLoaded, mockTableUrl } from '../../shared/api/mock-db';
import { calendarDay } from '../../shared/format/date-time';
import { Toaster } from '../../shared/ui/toaster';

/** Enough history for the longest period the screen offers plus the one it is compared with. */
const HISTORY_DAYS = 200;

/**
 * Daily attention figures of the active company.
 * - 'mock': precomputed in the prototype's JSON.
 * - 'api':  computed by vortomi-backend from the messages and the pipeline's history
 *           (GET /reports/days), in the company's time zone.
 */
@Injectable({ providedIn: 'root' })
export class ReportsData {
  private readonly session = inject(Session);
  private readonly mock = inject(API_CONFIG).mode === 'mock';
  private readonly api = inject(ApiClient);
  private readonly clock = inject(Clock);
  private readonly toaster = inject(Toaster);
  private readonly table = httpResource<ReportDay[]>(() => (this.mock ? mockTableUrl('report-days') : undefined), { defaultValue: [] });
  private readonly remoteDays = signal<ReportDay[]>([]);
  private readonly remoteLoaded = signal(false);

  readonly ready = computed(() => this.session.ready() && (this.mock ? allLoaded(this.table) : this.remoteLoaded()));

  /** Scoped to the active company (tenant_id), as the backend does. */
  readonly days = computed(() => {
    const tenantId = this.session.tenant()?.id;
    const rows = this.mock ? this.table.value() : this.remoteDays();
    return rows.filter((row) => row.tenantId === tenantId);
  });

  constructor() {
    if (this.mock) return;
    effect(() => {
      const tenant = this.session.tenant();
      if (tenant) untracked(() => void this.load(tenant.id, tenant.timezone));
    });
  }

  /** 'api' mode: reads the figures again (the screen calls it when it opens). */
  reload(): void {
    const tenant = this.session.tenant();
    if (!this.mock && tenant) void this.load(tenant.id, tenant.timezone);
  }

  private async load(tenantId: string, timezone: string): Promise<void> {
    const now = this.clock.now();
    const to = calendarDay(now.toISOString(), timezone);
    const from = calendarDay(new Date(now.getTime() - HISTORY_DAYS * 86_400_000).toISOString(), timezone);
    try {
      const list = await this.api.get<ApiList<Omit<ReportDay, 'tenantId'>>>(this.api.company(tenantId, 'reports/days'), { from, to });
      this.remoteDays.set(list.items.map((row) => ({ ...row, tenantId })));
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.remoteLoaded.set(true);
    }
  }
}
