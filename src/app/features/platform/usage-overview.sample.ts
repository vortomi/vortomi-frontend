// Preview mode (no server): steady sample figures so «Uso y salud» can be seen. Never real data.
import type { UsageMonth } from '../../shared/api/models';
import { type DayRange, daysOf } from '../reports/reports.rules';
import type { UsageOverview } from './usage-overview.rules';

/** A repeatable "random" figure per day and company: the same every time the screen opens. */
const wave = (seed: number, peak: number) => Math.round(((Math.sin(seed * 1.7) + 1) / 2) * peak);

export function sampleOverview(range: DayRange, tenantIds: readonly string[]): UsageOverview {
  const days = daysOf(range).flatMap((date, d) =>
    tenantIds.map((tenantId, i) => {
      const customers = wave(d * 3 + i * 7 + Number(date.slice(5, 7)), Math.max(4, 40 - i * 5));
      return { date, tenantId, fromCustomers: customers, automatic: Math.round(customers * 0.7), staff: Math.round(customers * 0.2), ownerApp: Math.round(customers * 0.05) };
    }),
  );
  return {
    from: range.from,
    to: range.to,
    days,
    delivery: tenantIds.map((tenantId, i) => ({ tenantId, outbound: Math.max(20, 300 - i * 40), delivered: Math.max(20, 300 - i * 40) - (i === 1 ? 2 : 0), failed: i === 1 ? 2 : 0 })),
    agent: tenantIds.map((tenantId, i) => ({ tenantId, replies: Math.max(0, 180 - i * 30), inputTokens: Math.max(0, 640_000 - i * 90_000), outputTokens: Math.max(0, 21_000 - i * 3_000) })),
    health: {
      webhooks: { pending: 0, retrying: 0, last24h: 412, lastAt: new Date(Date.now() - 3 * 60_000).toISOString() },
      numbers: { connected: tenantIds.length + 1, disconnected: 1, restricted: 0 },
      failedLast24h: 2,
      agentCompanies: Math.max(1, tenantIds.length - 1),
      companies: { active: tenantIds.length, numbers: tenantIds.length + 2, people: tenantIds.length * 3 },
    },
  };
}

export function sampleUsage(month: string, tenantIds: readonly string[]): UsageMonth[] {
  return tenantIds.map((tenantId, i) => ({
    tenantId,
    channelAccountId: `sample-${tenantId}`,
    month,
    totalMessages: Math.max(30, 900 - i * 130),
    serviceMessages: Math.max(15, 420 - i * 60),
    utilityMessages: i === 0 ? 60 : 0,
    marketingMessages: 0,
    freeEntryMessages: 0,
  }));
}
