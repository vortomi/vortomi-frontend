// What the platform team must act on (mockup web-25). The server computes every alert from the
// data it stores (GET /platform/alerts); the preview, without a server, derives the ones its sample
// tables can show: numbers and their access, and unfinished sign-ups.
import type { ApiPlatformAlert, ApiPlatformAlertReport } from '../../shared/api/contract';
import type { ChannelAccount, Tenant } from '../../shared/api/models';

export type PlatformAlert = ApiPlatformAlert;
export type AlertReport = ApiPlatformAlertReport;
export type AlertSeverity = PlatformAlert['severity'];
export type AlertCategory = PlatformAlert['category'];

const DAY_MS = 86_400_000;
const ACCESS_WARNING_DAYS = 7;
const STALLED_ONBOARDING_DAYS = 3;

/** The preview's report: the same shape the server answers. */
export function sampleAlertReport(tenants: Tenant[], channels: ChannelAccount[], now: Date): AlertReport {
  const live = tenants.filter((t) => t.status !== 'cancelled');
  const names = new Map(live.map((t) => [t.id, t.name]));
  const alerts: PlatformAlert[] = [];

  for (const tenant of live) {
    const unfinished = tenant.status === 'draft' || tenant.status === 'awaiting_channel' || tenant.status === 'awaiting_owner';
    const days = Math.floor((now.getTime() - new Date(tenant.createdAt).getTime()) / DAY_MS);
    if (unfinished && days >= STALLED_ONBOARDING_DAYS) {
      alerts.push({
        id: `${tenant.id}:onboarding`, kind: 'onboarding_stalled', severity: 'warning', category: 'onboarding',
        tenantId: tenant.id, tenantName: tenant.name, channelId: null, channelLabel: null, since: tenant.createdAt,
        facts: { days, waitingOwner: tenant.status === 'awaiting_owner' ? 1 : 0 },
      });
    }
  }

  const own = channels.filter((c) => names.has(c.tenantId));
  for (const channel of own) {
    const base = { tenantId: channel.tenantId, tenantName: names.get(channel.tenantId) ?? null, channelId: channel.id, channelLabel: channel.label, category: 'connection' as const };
    if (channel.status === 'disconnected') {
      alerts.push({ ...base, id: `${channel.id}:disconnected`, kind: 'channel_disconnected', severity: 'critical', since: null, facts: { reason: channel.statusReason ?? null } });
      continue;
    }
    if (channel.accessExpiresAt) {
      const left = Math.ceil((new Date(channel.accessExpiresAt).getTime() - now.getTime()) / DAY_MS);
      if (left <= 0) alerts.push({ ...base, id: `${channel.id}:access`, kind: 'access_expired', severity: 'critical', since: channel.accessExpiresAt, facts: {} });
      else if (left <= ACCESS_WARNING_DAYS) alerts.push({ ...base, id: `${channel.id}:access`, kind: 'access_expiring', severity: 'warning', since: channel.accessExpiresAt, facts: { days: left } });
    }
  }

  return {
    checkedAt: now.toISOString(),
    checked: { companies: live.length, numbers: own.length, connected: own.filter((c) => c.status === 'connected').length, appsUnread: 0 },
    alerts: sortAlerts(alerts),
  };
}

/** Critical first; inside each, the platform's own before any company's (as the server orders them). */
export function sortAlerts(alerts: PlatformAlert[]): PlatformAlert[] {
  const rank = (a: PlatformAlert) => (a.severity === 'critical' ? 0 : 2) + (a.tenantId ? 1 : 0);
  return [...alerts].sort((a, b) => rank(a) - rank(b));
}

/** The company sections of the page: each company with its alerts, the most urgent company first. */
export function byCompany(alerts: PlatformAlert[]): { tenantId: string; tenantName: string; alerts: PlatformAlert[] }[] {
  const groups = new Map<string, { tenantId: string; tenantName: string; alerts: PlatformAlert[] }>();
  for (const alert of alerts) {
    if (!alert.tenantId) continue;
    const group = groups.get(alert.tenantId) ?? { tenantId: alert.tenantId, tenantName: alert.tenantName ?? '', alerts: [] };
    group.alerts.push(alert);
    groups.set(alert.tenantId, group);
  }
  const critical = (g: { alerts: PlatformAlert[] }) => g.alerts.filter((a) => a.severity === 'critical').length;
  return [...groups.values()].sort((a, b) => critical(b) - critical(a) || b.alerts.length - a.alerts.length || a.tenantName.localeCompare(b.tenantName));
}
