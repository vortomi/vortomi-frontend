import type { TenantRow } from './platform.data';
import type { SetupItem, TenantDetailInsights, TenantListInsight, TenantListInsights } from './tenant-insights.remote';

// Preview mode (no server): figures drawn from each sample company's id, the same on every load,
// so the screens can be seen and photographed. Never shown with a real server.

const DAY_MS = 86_400_000;
const AGENT_CAP = 1000;

/** A small repeatable sequence of numbers per company. */
function seeded(id: string): () => number {
  let seed = [...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 17);
  return () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return (seed % 1000) / 1000;
  };
}

const live = (row: TenantRow) => row.tenant.status === 'active' || row.tenant.status === 'suspended';

function setupOf(row: TenantRow, next: () => number): SetupItem[] {
  if (!live(row)) return (['number', 'business_info', 'products', 'payment_methods', 'template', 'agent'] as const).map((step) => ({ step, done: false, count: step === 'products' || step === 'payment_methods' || step === 'template' ? 0 : null }));
  const products = Math.round(next() * 200);
  const methods = Math.round(next() * 4);
  const templates = Math.round(next() * 5);
  return [
    { step: 'number', done: row.channels.some((c) => c.status === 'connected'), count: null },
    { step: 'business_info', done: next() > 0.2, count: null },
    { step: 'products', done: products > 0, count: products },
    { step: 'payment_methods', done: methods > 0, count: methods },
    { step: 'template', done: templates > 0, count: templates },
    { step: 'agent', done: next() > 0.35, count: null },
  ];
}

function itemOf(row: TenantRow, now: Date): TenantListInsight {
  const next = seeded(row.tenant.id);
  const volume = live(row) ? 20 + Math.round(next() * 180) : 0;
  const daily = Array.from({ length: 14 }, (_, i) => (volume ? Math.round(volume * (0.4 + next()) * (i % 7 >= 5 ? 0.45 : 1)) : 0));
  const setup = setupOf(row, next);
  const agentEnabled = setup.find((s) => s.step === 'agent')!.done;
  return {
    tenantId: row.tenant.id,
    daily,
    lastActivityAt: volume ? new Date(now.getTime() - Math.round(next() * 6 * 3_600_000)).toISOString() : null,
    agentEnabled,
    agentReplies: agentEnabled ? Math.round(next() * 950) : 0,
    setupDone: setup.filter((s) => s.done).length,
    pendingInvitations: next() > 0.7 ? 1 : 0,
  };
}

export function sampleListInsights(rows: TenantRow[], now: Date): TenantListInsights {
  const items = rows.map((row) => itemOf(row, now));
  const month = items.reduce((sum, i) => sum + i.daily.reduce((a, b) => a + b, 0), 0) * 2;
  return { items, monthMessages: month, previousMonthMessages: Math.round(month * 0.89), agentRepliesMonth: items.reduce((s, i) => s + i.agentReplies, 0), agentCap: AGENT_CAP, setupTotal: 6 };
}

export function sampleDetailInsights(row: TenantRow, now: Date): TenantDetailInsights {
  const item = itemOf(row, now);
  const next = seeded(`${row.tenant.id}:detail`);
  const base = item.daily.reduce((a, b) => a + b, 0) / 14;
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(now.getTime() - (29 - i) * DAY_MS);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const total = Math.round(base * (0.55 + next() * 0.8) * (weekend ? 0.45 : 1));
    return { day: day.toISOString().slice(0, 10), fromCustomers: Math.round(total * 0.55), fromCompany: total - Math.round(total * 0.55) };
  });
  const messages30d = daily.reduce((s, d) => s + d.fromCustomers + d.fromCompany, 0);
  const setup = setupOf(row, seeded(row.tenant.id));
  return {
    daily,
    messages30d,
    previous30d: Math.round(messages30d * (0.85 + next() * 0.25)),
    openConversations: Math.round(base * 0.4),
    unassignedOpen: Math.round(base * 0.08),
    contacts: Math.round(base * 18),
    contactsThisMonth: Math.round(base * 1.2),
    ordersThisMonth: Math.round(base * 2),
    ordersAwaitingPayment: Math.round(next() * 9),
    agent: { enabled: item.agentEnabled, replies: item.agentReplies, cap: AGENT_CAP },
    lastActivity: item.lastActivityAt ? { at: item.lastActivityAt, fromCustomer: next() > 0.3 } : null,
    channels: row.channels.map((channel, index) => ({
      channelId: channel.id,
      connectedAt: new Date(new Date(row.tenant.createdAt).getTime() + index * 9 * DAY_MS).toISOString(),
      lastInboundAt: channel.status === 'disconnected' ? new Date(now.getTime() - 5 * DAY_MS).toISOString() : item.lastActivityAt,
      messages30d: Math.round(messages30d / (index + 1.6)),
      coexistence: channel.coexistence,
    })),
    setup,
    owner: null,
  };
}
