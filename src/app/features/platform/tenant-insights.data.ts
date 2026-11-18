import { Injectable, computed, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Clock } from '../../core/clock';
import { Directory } from '../../core/directory';
import type { Id } from '../../shared/api/models';
import { PlatformData } from './platform.data';
import { type TenantDetailInsights, type TenantListInsight, type TenantListInsights, TenantInsightsRemote } from './tenant-insights.remote';
import { sampleDetailInsights, sampleListInsights } from './tenant-insights.sample';

/**
 * The console's figures about companies (mockup web-25): the server's in 'api' mode, the sample
 * companies' in the preview. Apart from PlatformData so the list and the page keep working (with
 * their basic data) if these figures cannot be read.
 */
@Injectable({ providedIn: 'root' })
export class TenantInsightsData {
  private readonly platform = inject(PlatformData);
  private readonly clock = inject(Clock);
  private readonly directory = inject(Directory);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(TenantInsightsRemote) : null;

  private readonly remoteList = signal<TenantListInsights | null>(null);
  readonly error = signal<string | null>(null);

  readonly list = computed<TenantListInsights | null>(() =>
    this.remote ? this.remoteList() : this.platform.ready() ? sampleListInsights(this.platform.rows(), this.clock.now()) : null,
  );
  /** Each company's figures by id, for the rows of the list. */
  readonly byTenant = computed(() => new Map<Id, TenantListInsight>((this.list()?.items ?? []).map((item) => [item.tenantId, item])));

  async loadList(): Promise<void> {
    if (!this.remote) return;
    try {
      this.remoteList.set(await this.remote.list());
      this.error.set(null);
    } catch (error) {
      this.error.set(toApiFailure(error).message);
    }
  }

  /** One company's figures, or null when they cannot be read (the page shows its basic data). */
  async detail(tenantId: Id): Promise<TenantDetailInsights | null> {
    if (!this.remote) {
      // The sample companies may still be loading when the page opens.
      await this.directory.loaded;
      const row = this.platform.row(tenantId);
      return row ? sampleDetailInsights(row, this.clock.now()) : null;
    }
    try {
      return await this.remote.detail(tenantId);
    } catch {
      return null;
    }
  }
}
