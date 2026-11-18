import type { ChannelAccount, Tenant } from '../../shared/api/models';
import type { TenantRow } from './platform.data';
import type { TenantListInsight } from './tenant-insights.remote';
import { isQuiet, matchesSearch, numbersSummary, percentChange, sortRows, tabOf, timeAgo } from './tenant-list.rules';

const NOW = new Date('2026-11-18T15:00:00Z');
const tenant = (over: Partial<Tenant> = {}) =>
  ({ id: 't1', name: 'Repuestos Andinos', city: 'Caracas', legalName: 'Repuestos Andinos, C.A.', taxId: 'J-41234567-8', status: 'active', createdAt: '2026-08-18T12:00:00Z', ...over }) as Tenant;
const channel = (over: Partial<ChannelAccount> = {}) => ({ id: 'c1', status: 'connected', displayNumber: '+58 412-555-0101', accessExpiresAt: null, ...over }) as ChannelAccount;
const row = (t: Partial<Tenant> = {}, channels: ChannelAccount[] = [channel()]) => ({ tenant: tenant(t), channels }) as TenantRow;

describe('the list of companies', () => {
  it('sign-ups in progress share the «En alta» tab', () => {
    expect([tabOf('draft'), tabOf('awaiting_channel'), tabOf('awaiting_owner'), tabOf('cancelled')]).toEqual(['onboarding', 'onboarding', 'awaiting_owner', 'cancelled']);
  });

  it('searches by name without accents, RIF, legal name or the digits of a number', () => {
    expect(matchesSearch(row(), 'Repuestos', 'andinos')).toBe(true);
    expect(matchesSearch(row({ name: 'Óptica Visión' }), '', 'optica vision')).toBe(true);
    expect(matchesSearch(row(), '', '41234567')).toBe(true);
    expect(matchesSearch(row(), '', '5550101')).toBe(true);
    expect(matchesSearch(row(), '', 'farmacia')).toBe(false);
  });

  it('a company\'s numbers in a few words: the worst first', () => {
    expect(numbersSummary(row(), NOW)).toEqual({ text: 'bien', tone: 'green' });
    expect(numbersSummary(row({}, [channel(), channel({ id: 'c2' })]), NOW)?.text).toBe('ambos bien');
    expect(numbersSummary(row({}, [channel(), channel({ id: 'c2', status: 'disconnected' })]), NOW)).toEqual({ text: 'Desconectado', tone: 'red' });
    expect(numbersSummary(row({}, [channel({ accessExpiresAt: '2026-11-23T15:00:00Z' })]), NOW)).toEqual({ text: 'Acceso vence en 5 días', tone: 'amber' });
    expect(numbersSummary(row({}, []), NOW)).toBeNull();
  });

  it('sorts by recent activity, the companies without messages last', () => {
    const a = row({ id: 'a', name: 'A' });
    const b = row({ id: 'b', name: 'B' });
    const c = row({ id: 'c', name: 'C' });
    const insights = new Map<string, TenantListInsight>([
      ['a', { lastActivityAt: '2026-11-18T10:00:00Z', daily: [1] } as TenantListInsight],
      ['b', { lastActivityAt: '2026-11-18T14:00:00Z', daily: [9] } as TenantListInsight],
    ]);
    expect(sortRows([a, b, c], 'activity', insights).map((r) => r.tenant.name)).toEqual(['B', 'A', 'C']);
    expect(sortRows([a, b, c], 'messages', insights).map((r) => r.tenant.name)).toEqual(['B', 'A', 'C']);
  });

  it('time since the last message, and when an active company has gone quiet', () => {
    expect(timeAgo('2026-11-18T14:56:00Z', NOW)).toBe('hace 4 min');
    expect(timeAgo('2026-11-18T13:00:00Z', NOW)).toBe('hace 2 h');
    expect(timeAgo('2026-11-13T15:00:00Z', NOW)).toBe('hace 5 días');
    expect(isQuiet(tenant(), '2026-11-13T15:00:00Z', NOW)).toBe(true);
    expect(isQuiet(tenant({ status: 'awaiting_owner' }), null, NOW)).toBe(false);
  });

  it('compares with before, only when there was a before', () => {
    expect(percentChange(112, 100)).toBe(12);
    expect(percentChange(90, 100)).toBe(-10);
    expect(percentChange(5, 0)).toBeNull();
  });
});
