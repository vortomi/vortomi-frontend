import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { ApiInvitation, ApiList, ApiPlatformTenant, ApiPlatformTenantDetail, ApiUsageRow, ApiWabaLookup } from '../../shared/api/contract';
import type { Id, TenantPlan } from '../../shared/api/models';

export interface TenantFields {
  name: string;
  businessType: string;
  businessTypeOther: string;
  city: string;
  timezone: string;
  plan: TenantPlan;
  legalName: string;
  taxId: string;
  fiscalAddress: string;
}

/** Companies that wrote the same thing under «Otro». */
export interface UnclassifiedType {
  text: string;
  tenants: { id: Id; name: string }[];
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

  /** What companies wrote under «Otro», grouped, most companies first. */
  async unclassified(): Promise<UnclassifiedType[]> {
    return (await this.api.get<{ items: UnclassifiedType[] }>('platform/business-types/unclassified')).items;
  }

  /** A new type on the list, with the companies that asked for it. */
  createBusinessType(label: string, tenantIds: Id[]): Promise<{ code: string; label: string }> {
    return this.api.post('platform/business-types', { label, tenantIds });
  }

  reclassify(businessType: string, tenantIds: Id[]): Promise<{ moved: number }> {
    return this.api.post('platform/business-types/reclassify', { businessType, tenantIds });
  }

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

  /** An existing number's account: without a token, the one stored for the number serves. */
  lookupForChannel(tenantId: Id, channelId: Id, wabaId: string, accessToken: string): Promise<ApiWabaLookup> {
    return this.api.post(this.path(tenantId, `channels/${encodeURIComponent(channelId)}/lookup`), { wabaId, accessToken });
  }

  /** Points the number at another one of Meta (a number connected by mistake, or the real one). */
  replaceNumber(tenantId: Id, channelId: Id, change: { wabaId: string; phoneNumberId: string; accessToken: string }): Promise<{ displayNumber: string; subscribed: boolean }> {
    return this.api.put(this.path(tenantId, `channels/${encodeURIComponent(channelId)}`), change);
  }

  /** Writes the number again as Meta shows it. */
  refreshNumber(tenantId: Id, channelId: Id): Promise<{ displayNumber: string }> {
    return this.api.post(this.path(tenantId, `channels/${encodeURIComponent(channelId)}/refresh`));
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
