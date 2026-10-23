import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { ApiInvitation, ApiList, ApiTeamMember } from '../../shared/api/contract';
import { toTeamMember } from '../../shared/api/mappers';
import type { Id, Membership, TenantRole, User } from '../../shared/api/models';

export interface MemberAccess {
  role: TenantRole;
  canSeeOthers: boolean;
  channelAccountIds: Id[];
}

export interface InviteRequest extends MemberAccess {
  name: string;
  email: string;
}

/** The team against vortomi-backend ('api' mode). Only admins change it; the server enforces it. */
@Injectable({ providedIn: 'root' })
export class TeamRemote {
  private readonly api = inject(ApiClient);

  /** Everyone, disabled people included, for the team screen. */
  async members(tenantId: Id): Promise<{ user: User; membership: Membership }[]> {
    const list = await this.api.get<ApiList<ApiTeamMember>>(this.api.company(tenantId, 'team'), { include: 'disabled' });
    return list.items.map((row) => toTeamMember(tenantId, row));
  }

  updateMember(tenantId: Id, userId: Id, access: MemberAccess): Promise<void> {
    return this.api.put(this.api.company(tenantId, `team/${encodeURIComponent(userId)}`), access);
  }

  setStatus(tenantId: Id, userId: Id, status: 'active' | 'disabled'): Promise<void> {
    return this.api.put(this.api.company(tenantId, `team/${encodeURIComponent(userId)}/status`), { status });
  }

  async invitations(tenantId: Id): Promise<ApiInvitation[]> {
    return (await this.api.get<ApiList<ApiInvitation>>(this.api.company(tenantId, 'team/invitations'))).items;
  }

  invite(tenantId: Id, request: InviteRequest): Promise<ApiInvitation> {
    return this.api.post<ApiInvitation>(this.api.company(tenantId, 'team/invitations'), request);
  }

  renew(tenantId: Id, invitationId: Id): Promise<ApiInvitation> {
    return this.api.post<ApiInvitation>(this.api.company(tenantId, `team/invitations/${encodeURIComponent(invitationId)}/renew`));
  }

  revoke(tenantId: Id, invitationId: Id): Promise<void> {
    return this.api.delete(this.api.company(tenantId, `team/invitations/${encodeURIComponent(invitationId)}`));
  }

  renameChannel(tenantId: Id, channelId: Id, label: string): Promise<unknown> {
    return this.api.put(this.api.company(tenantId, `channels/${encodeURIComponent(channelId)}`), { label });
  }
}
