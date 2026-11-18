import { ago, barsOf, companyRows, healthItems, kpisOf, type UsageOverview } from './usage-overview.rules';

const base: UsageOverview = {
  from: '2026-11-01',
  to: '2026-11-03',
  days: [
    { date: '2026-11-01', tenantId: 'a', fromCustomers: 8, automatic: 9, staff: 1, ownerApp: 0 },
    { date: '2026-11-03', tenantId: 'a', fromCustomers: 4, automatic: 2, staff: 0, ownerApp: 1 },
    { date: '2026-11-03', tenantId: 'b', fromCustomers: 2, automatic: 0, staff: 2, ownerApp: 0 },
  ],
  delivery: [{ tenantId: 'a', outbound: 10, delivered: 9, failed: 1 }],
  agent: [{ tenantId: 'a', replies: 9, inputTokens: 1000, outputTokens: 50 }],
  health: {
    webhooks: { pending: 0, retrying: 0, last24h: 12, lastAt: '2026-11-03T11:56:00Z' },
    numbers: { connected: 2, disconnected: 0, restricted: 0 },
    failedLast24h: 0,
    agentCompanies: 1,
    companies: { active: 2, numbers: 2, people: 3 },
  },
};

describe('«Uso y salud» rules', () => {
  it('counts the period and compares it with the one before', () => {
    const before = { ...base, days: [{ date: '2026-10-01', tenantId: 'a', fromCustomers: 10, automatic: 10, staff: 0, ownerApp: 0 }], delivery: [] };
    expect(kpisOf(base, before)).toMatchObject({
      messages: 29,
      messagesChange: 45,
      automatic: 11,
      answers: 15,
      automaticPercent: 73,
      deliveredPercent: 90,
      failed: 1,
    });
    expect(kpisOf({ ...base, days: [], delivery: [] }, null)).toMatchObject({ messages: 0, messagesChange: null, automaticPercent: null, deliveredPercent: null });
  });

  it('never reads 100 % delivered while something failed', () => {
    expect(kpisOf({ ...base, delivery: [{ tenantId: 'a', outbound: 1260, delivered: 1258, failed: 2 }] }, null).deliveredPercent).toBe(99);
  });

  it('gives every day of the range a pair of bars, empty days included', () => {
    expect(barsOf(base, { from: '2026-11-01', to: '2026-11-03' })).toEqual([
      { date: '2026-11-01', conversations: 8, onTime: 10 },
      { date: '2026-11-02', conversations: 0, onTime: 0 },
      { date: '2026-11-03', conversations: 6, onTime: 5 },
    ]);
  });

  it('lists the companies busiest first, with their free replies and estimate', () => {
    const usage = [{ tenantId: 'b', channelAccountId: 'n', month: '2026-11', totalMessages: 4, serviceMessages: 2, utilityMessages: 0, marketingMessages: 0, freeEntryMessages: 0 }];
    const rows = companyRows(base, usage, new Map([['a', 'Panadería'], ['b', 'Ferretería']]));
    expect(rows.map((r) => [r.name, r.messages, r.automaticPercent, r.agentReplies, r.freeUsed, r.free, r.estimate])).toEqual([
      ['Panadería', 25, 85, 9, 0, 0, '0,00 $'],
      ['Ferretería', 4, 0, 0, 2, 1000, '0,00 $'],
    ]);
  });

  it('turns a health line red or amber, saying why', () => {
    const now = new Date('2026-11-03T12:00:00Z');
    expect(healthItems(base, now).map((h) => [h.id, h.tone, h.status])).toEqual([
      ['webhooks', 'green', 'Al día'],
      ['numbers', 'green', 'Todos bien'],
      ['delivery', 'green', 'Sin fallas'],
      ['agent', 'green', 'Activo'],
    ]);
    const bad = { ...base, health: { ...base.health, webhooks: { ...base.health.webhooks, retrying: 3, pending: 3 }, numbers: { connected: 1, disconnected: 1, restricted: 0 }, failedLast24h: 2, agentCompanies: 0 } };
    expect(healthItems(bad, now).map((h) => [h.tone, h.status])).toEqual([
      ['red', '3 reintentando'],
      ['red', '1 desconectado'],
      ['amber', '2 fallidos'],
      ['neutral', 'Apagado'],
    ]);
    expect(healthItems(base, now)[0]!.hint).toBe('12 recibidos en 24 h · el último hace 4 min · 0 pendientes');
  });

  it('says how long ago in words', () => {
    const now = new Date('2026-11-03T12:00:00Z');
    expect([ago(null, now), ago('2026-11-03T11:59:50Z', now), ago('2026-11-03T09:00:00Z', now), ago('2026-10-30T12:00:00Z', now)]).toEqual([
      'nunca', 'hace un momento', 'hace 3 h', 'hace 4 días',
    ]);
  });
});
