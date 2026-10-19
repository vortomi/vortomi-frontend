import type { ChannelAccount, Tenant } from '../../shared/api/models';
import { platformAlerts } from './platform-alerts';

const NOW = new Date('2026-10-09T10:24:00-04:00');

const tenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: 'ten_a',
  name: 'Empresa A',
  slug: 'a',
  status: 'active',
  plan: 'basic',
  industry: 'Otro',
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

describe('platformAlerts', () => {
  it('is quiet when everything is healthy', () => {
    expect(platformAlerts([tenant()], [channel()], NOW)).toEqual([]);
  });

  it('flags a disconnected number as critical and puts it first', () => {
    const alerts = platformAlerts(
      [tenant()],
      [channel({ qualityRating: 'low', id: 'ch_b' }), channel({ status: 'disconnected' })],
      NOW,
    );
    expect(alerts.map((a) => a.kind)).toEqual(['channel_disconnected', 'quality_low']);
    expect(alerts[0]?.severity).toBe('critical');
  });

  it('warns a week before Meta access expires', () => {
    const [alert] = platformAlerts([tenant()], [channel({ accessExpiresAt: '2026-10-14T00:00:00-04:00' })], NOW);
    expect(alert?.kind).toBe('access_expiring');
    expect(alert?.text).toContain('5 días');
  });

  it('flags onboardings left half way for days', () => {
    const [alert] = platformAlerts([tenant({ status: 'draft', createdAt: '2026-10-04T09:00:00-04:00' })], [], NOW);
    expect(alert?.kind).toBe('onboarding_stalled');
  });

  it('ignores cancelled companies', () => {
    expect(platformAlerts([tenant({ status: 'cancelled' })], [channel({ status: 'disconnected' })], NOW)).toEqual([]);
  });
});
