import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { ApiInvitation, ApiList, ApiPlatformTenant, ApiPlatformTenantDetail, ApiUsageRow, ApiWabaLookup } from '../../shared/api/contract';
import type { Id, TenantPlan } from '../../shared/api/models';

export interface TenantFields {
  name: string;
  industry: string;
  city: string;
  timezone: string;
  plan: TenantPlan;
  legalName: string;
  taxId: string;
  fiscalAddress: string;
}

export interface ChannelConnection {
  wabaId: string;
  accessToken: string;
  phoneNumberId: string;
  displayNumber: string;
  label: string;
}

/**
 * The platform console against vortomi-backend ('api' mode). Our team only, with the second
 * factor (the server checks both on every call). Company data and counts, never conversations.
 */
@Injectable({ providedIn: 'root' })
export class PlatformRemote {
  private readonly api = inject(ApiClient);

  async tenants(): Promise<ApiPlatformTenant[]> {
    return (await this.api.get<{ tenants: ApiPlatformTenant[] }>('platform/tenants')).tenants;
  }

  tenant(tenantId: Id): Promise<ApiPlatformTenantDetail> {
    return this.api.get(this.path(tenantId));
  }

  create(fields: TenantFields): Promise<{ id: Id }> {
    return this.api.post('platform/tenants', fields);
  }

  update(tenantId: Id, fields: TenantFields): Promise<unknown> {
    return this.api.put(this.path(tenantId), fields);
  }

  setStatus(tenantId: Id, status: 'active' | 'suspended' | 'cancelled'): Promise<void> {
    return this.api.put(this.path(tenantId, 'status'), { status });
  }

  /** The token goes in the body, never in the address. */
  lookup(tenantId: Id, wabaId: string, accessToken: string): Promise<ApiWabaLookup> {
    return this.api.post(this.path(tenantId, 'channels/lookup'), { wabaId, accessToken });
  }

  connect(tenantId: Id, connection: ChannelConnection): Promise<{ id: Id; subscribed: boolean }> {
    return this.api.post(this.path(tenantId, 'channels'), connection);
  }

  /** When a customer message last arrived since `since` (the sign-up test); never its content. */
  async lastInbound(tenantId: Id, since: string): Promise<string | null> {
    return (await this.api.get<{ receivedAt: string | null }>(this.path(tenantId, 'inbound'), { since })).receivedAt;
  }

  inviteAdmin(tenantId: Id, name: string, email: string): Promise<ApiInvitation> {
    return this.api.post(this.path(tenantId, 'invitations'), { name, email });
  }

  renewInvitation(tenantId: Id, invitationId: Id): Promise<ApiInvitation> {
    return this.api.post(this.path(tenantId, `invitations/${encodeURIComponent(invitationId)}/renew`));
  }

  revokeInvitation(tenantId: Id, invitationId: Id): Promise<void> {
    return this.api.delete(this.path(tenantId, `invitations/${encodeURIComponent(invitationId)}`));
  }

  async usage(month: string): Promise<ApiUsageRow[]> {
    return (await this.api.get<ApiList<ApiUsageRow>>('platform/usage', { month })).items;
  }

  private path(tenantId: Id, rest = ''): string {
    return `platform/tenants/${encodeURIComponent(tenantId)}${rest ? `/${rest}` : ''}`;
  }
}
