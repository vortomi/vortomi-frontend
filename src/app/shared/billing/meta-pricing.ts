// What Meta charges each company for WhatsApp, estimated from the counted messages.
// Since 1 Oct 2026 Meta bills every delivered message, including replies inside the 24 h window,
// but the first 1,000 service messages of each month are free PER BUSINESS NUMBER (not per company).
// Messages inside a 72 h free entry point window (click-to-WhatsApp ads) are never charged.
import type { UsageMonth } from '../api/models';

export const FREE_SERVICE_PER_NUMBER = 1000;

/**
 * Reference rates of the "Rest of Latin America" market, the one that bills Venezuelan numbers.
 * To confirm against Meta's rate card; the real amount is the one Meta reports days later.
 */
export const META_RATES_USD = { service: 0.0113, utility: 0.0113, marketing: 0.074 } as const;

export interface MetaSpend {
  numbers: number;
  totalMessages: number;
  service: { sent: number; free: number; billable: number; cents: number };
  utility: { sent: number; cents: number };
  marketing: { sent: number; cents: number };
  freeEntry: { sent: number };
  /** Numbers that already used up their free service messages this month. */
  overFreeChannelIds: string[];
  totalCents: number;
}

const toCents = (messages: number, rateUsd: number): number => Math.round(messages * rateUsd * 100);

/** Service messages of one number that exceed its monthly free tier. */
export const billableService = (serviceMessages: number): number => Math.max(0, serviceMessages - FREE_SERVICE_PER_NUMBER);

/** Spend of one company in one month. Expects one row per number. */
export function estimateSpend(rows: readonly UsageMonth[]): MetaSpend {
  const sum = (pick: (row: UsageMonth) => number) => rows.reduce((total, row) => total + pick(row), 0);
  // The free tier is applied number by number, never to the company total.
  const billable = sum((row) => billableService(row.serviceMessages));
  const service = {
    sent: sum((row) => row.serviceMessages),
    free: rows.length * FREE_SERVICE_PER_NUMBER,
    billable,
    cents: toCents(billable, META_RATES_USD.service),
  };
  const utility = { sent: sum((row) => row.utilityMessages), cents: toCents(sum((row) => row.utilityMessages), META_RATES_USD.utility) };
  const marketing = {
    sent: sum((row) => row.marketingMessages),
    cents: toCents(sum((row) => row.marketingMessages), META_RATES_USD.marketing),
  };
  return {
    numbers: rows.length,
    totalMessages: sum((row) => row.totalMessages),
    service,
    utility,
    marketing,
    freeEntry: { sent: sum((row) => row.freeEntryMessages) },
    overFreeChannelIds: rows.filter((row) => billableService(row.serviceMessages) > 0).map((row) => row.channelAccountId),
    totalCents: service.cents + utility.cents + marketing.cents,
  };
}
