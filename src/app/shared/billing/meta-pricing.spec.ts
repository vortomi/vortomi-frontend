import type { UsageMonth } from '../api/models';
import { billableService, estimateSpend } from './meta-pricing';

const row = (channelAccountId: string, counts: Partial<UsageMonth> = {}): UsageMonth => ({
  tenantId: 'ten_a',
  channelAccountId,
  month: '2026-10',
  totalMessages: 0,
  serviceMessages: 0,
  utilityMessages: 0,
  marketingMessages: 0,
  freeEntryMessages: 0,
  ...counts,
});

describe('billableService', () => {
  it('charges only above the 1,000 free messages', () => {
    expect(billableService(999)).toBe(0);
    expect(billableService(1000)).toBe(0);
    expect(billableService(1250)).toBe(250);
  });
});

describe('estimateSpend', () => {
  it('applies the free tier per number, not to the company total', () => {
    // 1,500 in total would look free with 2 numbers if summed first; the busy number still pays 400.
    const spend = estimateSpend([row('ch_1', { serviceMessages: 1400 }), row('ch_2', { serviceMessages: 100 })]);
    expect(spend.service).toEqual({ sent: 1500, free: 2000, billable: 400, cents: 452 });
    expect(spend.overFreeChannelIds).toEqual(['ch_1']);
  });

  it('charges every template and never the free entry point messages', () => {
    const spend = estimateSpend([row('ch_1', { utilityMessages: 392, marketingMessages: 10, freeEntryMessages: 58 })]);
    expect(spend.utility.cents).toBe(443);
    expect(spend.marketing.cents).toBe(74);
    expect(spend.freeEntry.sent).toBe(58);
    expect(spend.totalCents).toBe(517);
  });

  it('is zero for a company without numbers', () => {
    expect(estimateSpend([])).toMatchObject({ numbers: 0, totalCents: 0, overFreeChannelIds: [] });
  });
});
