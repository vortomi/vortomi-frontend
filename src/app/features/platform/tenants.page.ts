import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CHANNEL_STATUS, QUALITY, TENANT_PLAN, TENANT_STATUS } from '../../shared/api/labels';
import { formatCount } from '../../shared/format/money';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { AlertList } from './alert-list';
import { PlatformData, type TenantRow } from './platform.data';

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Every company on the platform (mockup web-7). */
@Component({
  selector: 'app-tenants-page',
  imports: [RouterLink, Avatar, Icon, Pill, AlertList],
  templateUrl: './tenants.page.html',
  styleUrl: './platform-pages.scss',
})
export class TenantsPage {
  protected readonly data = inject(PlatformData);
  private readonly router = inject(Router);

  protected readonly search = signal('');
  protected readonly labels = { status: TENANT_STATUS, plan: TENANT_PLAN, channel: CHANNEL_STATUS, quality: QUALITY };
  protected readonly count = formatCount;

  constructor() {
    // 'api' mode: the list from the server, fresh every time the page opens.
    void this.data.load();
  }

  protected readonly rows = computed(() => {
    const needle = normalize(this.search().trim());
    return this.data
      .rows()
      .filter((r) => !needle || normalize(`${r.tenant.name} ${r.tenant.city} ${r.tenant.industry}`).includes(needle))
      .sort((a, b) => a.tenant.name.localeCompare(b.tenant.name, 'es'));
  });

  protected open(row: TenantRow): void {
    const unfinished = row.tenant.status === 'draft' || row.tenant.status === 'awaiting_channel';
    void (unfinished
      ? this.router.navigate(['/platform/tenants/new'], { queryParams: { resume: row.tenant.id } })
      : this.router.navigate(['/platform/tenants', row.tenant.id]));
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
}
