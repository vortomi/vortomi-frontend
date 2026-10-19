import { Injectable, computed, inject } from '@angular/core';
import type { DayHours, Id, Membership, TenantSettings, User } from '../shared/api/models';
import { CompanyData } from './company-data';
import { Directory } from './directory';
import { Session } from './session';

export interface TeamMember {
  user: User;
  membership: Membership;
}

const DEFAULT_HOURS: DayHours[] = [1, 2, 3, 4, 5, 6, 0].map((day) => ({
  day: day as DayHours['day'],
  open: day === 0 ? null : '08:00',
  close: day === 0 ? null : '17:00',
}));

/** Reference data of the active company: numbers, team, tags, stages, replies, templates, settings and usage. */
@Injectable({ providedIn: 'root' })
export class Workspace {
  private readonly session = inject(Session);
  private readonly directory = inject(Directory);
  private readonly company = inject(CompanyData);

  // Every list is scoped to the active company, the same rule the backend enforces with tenant_id.
  readonly channels = this.scoped(() => this.directory.channels());
  readonly tags = this.scoped(() => this.company.tags.rows());
  readonly quickReplies = this.scoped(() => this.company.quickReplies.rows());
  readonly templates = this.scoped(() => this.company.templates.rows());
  private readonly scopedStages = this.scoped(() => this.company.stages.rows());
  private readonly scopedSettings = this.scoped(() => this.company.settings.rows());
  readonly stages = computed(() => [...this.scopedStages()].sort((a, b) => a.position - b.position));
  /** Meta consumption of this month, one row per number. */
  readonly usage = this.scoped(() => this.directory.usage());

  /** Settings of the active company, with defaults when it never saved any. */
  readonly settings = computed<TenantSettings | null>(() => {
    const tenantId = this.session.tenant()?.id;
    if (!tenantId) return null;
    return (
      this.scopedSettings()[0] ?? { id: `set_${tenantId}`, tenantId, logoDataUrl: null, businessHours: DEFAULT_HOURS, awayMessage: '' }
    );
  });

  /** Pipeline, inventory and sales figures are on unless the company chose support only. */
  readonly sells = computed(() => (this.settings()?.workMode ?? 'sales_and_support') === 'sales_and_support');

  readonly team = computed<TeamMember[]>(() => {
    const tenantId = this.session.tenant()?.id;
    const users = this.directory.userById();
    return this.directory
      .memberships()
      .filter((m) => m.tenantId === tenantId)
      .flatMap((membership) => {
        const user = users.get(membership.userId);
        return user ? [{ user, membership }] : [];
      });
  });

  readonly activeTeam = computed(() => this.team().filter((m) => m.membership.status === 'active'));

  readonly channelById = computed(() => new Map(this.channels().map((c) => [c.id, c])));
  readonly tagById = computed(() => new Map(this.tags().map((t) => [t.id, t])));
  readonly stageById = computed(() => new Map(this.stages().map((s) => [s.id, s])));
  readonly userById = this.directory.userById;

  /** Active people who attend a given number, for the assignment menu. */
  attendantsOf(channelId: Id): TeamMember[] {
    return this.activeTeam().filter((m) => m.membership.channelAccountIds.includes(channelId));
  }

  private scoped<T extends { tenantId: Id }>(rows: () => T[]) {
    return computed(() => {
      const tenantId = this.session.tenant()?.id;
      return rows().filter((row) => row.tenantId === tenantId);
    });
  }
}
