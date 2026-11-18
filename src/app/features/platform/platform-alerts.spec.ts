import type { ChannelAccount, Tenant } from '../../shared/api/models';
import { alertCopy, sinceText } from './alert-texts';
import { type PlatformAlert, byCompany, sampleAlertReport } from './platform-alerts';

const NOW = new Date('2026-10-09T10:24:00-04:00');

const tenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: 'ten_a',
  name: 'Empresa A',
  slug: 'a',
  status: 'active',
  plan: 'basic',
  businessType: 'other',
  businessTypeOther: '',
  city: 'Caracas',
  timezone: 'America/Caracas',
  currency: 'USD',
  legalName: 'Empresa A, C.A.',
  taxId: 'J-41234567-8',
  fiscalAddress: 'Caracas',
  createdAt: '2026-08-01T09:00:00-04:00',
  ...overrides,
});

const channel = (overrides: Partial<ChannelAccount> = {}): ChannelAccount => ({
  id: 'ch_a',
  tenantId: 'ten_a',
  label: 'Ventas',
  displayNumber: '0412-000-0000',
  phoneNumberId: '1',
  wabaId: '2',
  status: 'connected',
  qualityRating: 'high',
  messagingTier: 1000,
  coexistence: false,
  color: '#000',
  accessExpiresAt: '2027-01-01T00:00:00-04:00',
  ...overrides,
});

const alertsOf = (tenants: Tenant[], channels: ChannelAccount[]) => sampleAlertReport(tenants, channels, NOW).alerts;

describe('the alerts of the preview (the server computes the real ones)', () => {
  it('is quiet when everything is healthy, and says what it looked at', () => {
    const report = sampleAlertReport([tenant()], [channel()], NOW);
    expect(report.alerts).toEqual([]);
    expect(report.checked).toEqual({ companies: 1, numbers: 1, connected: 1 });
  });

  it('a disconnected number is critical and goes first, with why', () => {
    const alerts = alertsOf([tenant()], [channel({ id: 'ch_b', accessExpiresAt: '2026-10-14T00:00:00-04:00' }), channel({ status: 'disconnected', statusReason: 'owner_disconnected' })]);
    expect(alerts.map((a) => a.kind)).toEqual(['channel_disconnected', 'access_expiring']);
    expect(alertCopy(alerts[0]!).text).toContain('El dueño lo desconectó desde su teléfono');
    expect(alertCopy(alerts[1]!).title).toBe('El acceso a su cuenta de Meta vence en 5 días');
  });

  it('asks us to call an owner who has not connected their number after days; cancelled companies are left out', () => {
    const [alert] = alertsOf([tenant({ status: 'awaiting_owner', createdAt: '2026-10-04T09:00:00-04:00' })], []);
    expect(alertCopy(alert!).title).toBe('El dueño todavía no conecta su número');
    expect(alertsOf([tenant({ status: 'cancelled' })], [channel({ status: 'disconnected' })])).toEqual([]);
  });
});

const alert = (overrides: Partial<PlatformAlert>): PlatformAlert => ({
  id: 'x', kind: 'agent_cap_reached', severity: 'critical', category: 'agent', tenantId: 't1', tenantName: 'Panadería Corteza',
  channelId: null, channelLabel: null, since: null, facts: { replies: 1000, cap: 1000 }, ...overrides,
});

describe('what each alert says', () => {
  it('the facts of the server become what is happening and what to do', () => {
    expect(alertCopy(alert({})).text).toBe('Usó sus 1.000 respuestas del mes: desde ahí pasa cada conversación a una persona.');
    const free = alertCopy(alert({ kind: 'free_replies_exceeded', severity: 'warning', category: 'usage', channelLabel: 'Ventas', facts: { replies: 1140, free: 1000 } }));
    expect(free.text).toBe('El número Ventas lleva 1.140 respuestas este mes: desde la 1.001, Meta cobra cada una a la tarjeta de la empresa.');
    expect(free.action).toEqual({ label: 'Ver consumo', link: ['/platform/usage'] });
    expect(alertCopy(alert({ kind: 'webhooks_failed', tenantId: null, facts: { count: 2, lastError: 'timeout' } })).text).toContain('2 avisos de Meta fallaron en todos los intentos (último error: «timeout»)');
  });

  it('since when, as people say it', () => {
    const now = new Date('2026-11-18T15:00:00Z');
    expect(sinceText(alert({ since: '2026-11-18T13:00:00Z' }), now)).toBe('desde hace 2 h');
    expect(sinceText(alert({ since: '2026-11-18T14:55:00Z' }), now)).toBe('desde hace 5 min');
    expect(sinceText(alert({ since: '2026-11-16T12:00:00Z' }), now)).toBe('desde el 16 nov');
    expect(sinceText(alert({ kind: 'access_expiring', since: '2026-11-23T12:00:00Z' }), now)).toBe('vence el 23 nov');
  });

  it('groups the alerts by company, the one with critical ones first', () => {
    const groups = byCompany([
      alert({ id: 'a', tenantId: 't2', tenantName: 'B', severity: 'warning' }),
      alert({ id: 'b', tenantId: 't1', tenantName: 'A' }),
      alert({ id: 'c', tenantId: null, tenantName: null }),
      alert({ id: 'd', tenantId: 't2', tenantName: 'B', severity: 'warning' }),
    ]);
    expect(groups.map((g) => [g.tenantName, g.alerts.length])).toEqual([['A', 1], ['B', 2]]);
  });
});
