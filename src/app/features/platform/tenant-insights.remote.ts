import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { Id } from '../../shared/api/models';

// The console's figures about companies (mockup web-25), as GET /platform/tenants/insights and
// /platform/tenants/:id/insights answer them (vortomi-backend tenant-insights.ts).

export type SetupStep = 'number' | 'business_info' | 'products' | 'payment_methods' | 'template' | 'agent';

export interface SetupItem {
  step: SetupStep;
  done: boolean;
  count: number | null;
}

export interface TenantListInsight {
  tenantId: Id;
  /** Messages of each of the last 14 days, oldest first; the last one is today. */
  daily: number[];
  lastActivityAt: string | null;
  agentEnabled: boolean;
  agentReplies: number;
  setupDone: number;
  pendingInvitations: number;
}

export interface TenantListInsights {
  items: TenantListInsight[];
  monthMessages: number;
  /** The same days of last month, to compare. */
  previousMonthMessages: number;
  agentRepliesMonth: number;
  agentCap: number;
  setupTotal: number;
}

export interface TenantDetailInsights {
  daily: { day: string; fromCustomers: number; fromCompany: number }[];
  messages30d: number;
  previous30d: number;
  openConversations: number;
  unassignedOpen: number;
  contacts: number;
  contactsThisMonth: number;
  ordersThisMonth: number;
  ordersAwaitingPayment: number;
  agent: { enabled: boolean; replies: number; cap: number };
  lastActivity: { at: string; fromCustomer: boolean } | null;
  channels: { channelId: Id; connectedAt: string; lastInboundAt: string | null; messages30d: number; coexistence: boolean }[];
  setup: SetupItem[];
  owner: { name: string; email: string } | null;
}

@Injectable({ providedIn: 'root' })
export class TenantInsightsRemote {
  private readonly api = inject(ApiClient);

  list(): Promise<TenantListInsights> {
    return this.api.get<TenantListInsights>('platform/tenants/insights');
  }

  detail(tenantId: Id): Promise<TenantDetailInsights> {
    return this.api.get<TenantDetailInsights>(`platform/tenants/${encodeURIComponent(tenantId)}/insights`);
  }
}
