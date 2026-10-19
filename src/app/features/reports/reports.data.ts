import { Injectable, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { Session } from '../../core/session';
import type { ReportDay } from '../../shared/api/models';
import { allLoaded, mockTableUrl } from '../../shared/api/mock-db';

/**
 * Daily attention figures of the active company. In the prototype they come precomputed from JSON;
 * the backend will compute them from the messages (GET /reports) and only this file changes.
 */
@Injectable({ providedIn: 'root' })
export class ReportsData {
  private readonly session = inject(Session);
  private readonly table = httpResource<ReportDay[]>(() => mockTableUrl('report-days'), { defaultValue: [] });

  readonly ready = computed(() => this.session.ready() && allLoaded(this.table));

  /** Scoped to the active company (tenant_id), as the backend will do. */
  readonly days = computed(() => {
    const tenantId = this.session.tenant()?.id;
    return this.table.value().filter((row) => row.tenantId === tenantId);
  });
}
