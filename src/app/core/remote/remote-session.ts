import { Injectable, inject } from '@angular/core';
import type { ApiChannel, ApiList, ApiMe, ApiMember, ApiQuickReply, ApiSettings, ApiStage, ApiTag, ApiTeamMember, ApiTemplate } from '../../shared/api/contract';
import {
  toChannel,
  toQuickReply,
  toSettings,
  toStage,
  toTag,
  toTeamMember,
  toTemplate,
  toTenant,
} from '../../shared/api/mappers';
import type { Id, Membership, User } from '../../shared/api/models';
import { ApiClient } from '../api/api-client';
import { CompanyData } from '../company-data';
import { Directory } from '../directory';

/**
 * 'api' mode: fills the panel's stores from vortomi-backend, so every screen keeps reading
 * Directory, CompanyData and Workspace exactly as in the prototype.
 *  - loadMe():          who I am and the companies I can enter (/me).
 *  - loadCompany(id):   my place, team, numbers and configuration in one company.
 * Only the active company's rows are held; the server already scoped every answer.
 */
@Injectable({ providedIn: 'root' })
export class RemoteSession {
  private readonly api = inject(ApiClient);
  private readonly directory = inject(Directory);
  private readonly company = inject(CompanyData);

  async loadMe(): Promise<ApiMe> {
    const me = await this.api.get<ApiMe>('me');
    const user: User = { id: me.user.id, name: me.user.name, email: me.user.email, platformRole: me.user.platformRole };
    this.directory.users.set([user]);
    this.directory.tenants.set(me.companies.map(toTenant));
    // Provisional until the company is opened: role from /me; numbers and permissions from loadCompany().
    this.directory.memberships.set(
      me.companies.map(
        (company): Membership => ({
          tenantId: company.tenantId,
          userId: me.user.id,
          role: company.role,
          status: 'active',
          channelAccountIds: [],
          canSeeOthers: company.role === 'admin',
        }),
      ),
    );
    return me;
  }

  /** Loads everything the panel shows about one company. Fails as a whole: no half-loaded company. */
  async loadCompany(tenantId: Id): Promise<void> {
    const path = (resource: string) => this.api.company(tenantId, resource);
    const [member, team, channels, tags, stages, quickReplies, templates, settings] = await Promise.all([
      this.api.get<ApiMember>(path('me')),
      this.api.get<ApiList<ApiTeamMember>>(path('team')),
      this.api.get<ApiList<ApiChannel>>(path('channels')),
      this.api.get<ApiList<ApiTag>>(path('tags')),
      this.api.get<ApiList<ApiStage>>(path('pipeline/stages')),
      this.api.get<ApiList<ApiQuickReply>>(path('quick-replies')),
      this.api.get<ApiList<ApiTemplate>>(path('templates')),
      this.api.get<ApiSettings>(path('settings')),
    ]);

    const people = team.items.map((row) => toTeamMember(tenantId, row));
    const me = this.directory.users().find((u) => u.id === member.userId);
    this.directory.users.set([
      ...(me ? [me] : []),
      // The team endpoint has no email for agents; keep mine from /me.
      ...people.map((p) => p.user).filter((u) => u.id !== member.userId),
    ]);
    this.directory.memberships.update((rows) => [
      ...rows.filter((m) => m.tenantId !== tenantId),
      ...people.map((p) => p.membership),
    ]);
    this.directory.channels.set(channels.items.map((row, index) => toChannel(tenantId, row, index)));

    this.company.tags.replaceAll(tags.items.map((row) => toTag(tenantId, row)));
    this.company.stages.replaceAll(stages.items.map((row) => toStage(tenantId, row)));
    this.company.quickReplies.replaceAll(quickReplies.items.map((row) => toQuickReply(tenantId, row)));
    this.company.templates.replaceAll(templates.items.map((row) => toTemplate(tenantId, row)));
    this.company.settings.replaceAll([toSettings(tenantId, settings)]);
  }

  /** Signed out: nothing of the previous person stays in memory. */
  clear(): void {
    this.directory.users.set([]);
    this.directory.tenants.set([]);
    this.directory.memberships.set([]);
    this.directory.channels.set([]);
    for (const table of [this.company.tags, this.company.stages, this.company.quickReplies, this.company.templates, this.company.settings]) {
      table.rows.set([]);
    }
  }
}
