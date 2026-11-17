import type { ChannelAccount } from '../shared/api/models';
import { channelNotices } from './channel-notices';

const channel = (overrides: Partial<ChannelAccount> = {}): ChannelAccount => ({
  id: 'ch_a',
  tenantId: 'ten_a',
  label: 'Citas',
  displayNumber: '0241-555-0120',
  phoneNumberId: '1',
  wabaId: '2',
  status: 'connected',
  qualityRating: 'high',
  messagingTier: 1000,
  coexistence: false,
  color: '#000',
  accessExpiresAt: null,
  ...overrides,
});

describe('channelNotices', () => {
  it('says nothing while every number works', () => {
    expect(channelNotices([channel()], true)).toEqual([]);
  });

  it('warns about a disconnected number and tells each role who fixes it', () => {
    const [admin] = channelNotices([channel({ status: 'disconnected' })], true);
    const [agent] = channelNotices([channel({ status: 'disconnected' })], false);
    expect(admin?.title).toBe('El número Citas (0241-555-0120) no está recibiendo mensajes');
    expect(admin?.detail).toContain('escríbenos');
    expect(agent?.detail).toContain('Avísale a la administración');
  });

  it('says why: the owner disconnected it from the phone, and how to bring it back', () => {
    const [notice] = channelNotices([channel({ status: 'disconnected', statusReason: 'owner_disconnected' })], true);
    expect(notice?.title).toBe('El número Citas (0241-555-0120) se desconectó de Vortomi desde el teléfono');
    expect(notice?.detail).toContain('Conectar con WhatsApp');
  });

  it('a ban is not something reconnecting fixes', () => {
    const [notice] = channelNotices([channel({ status: 'disconnected', statusReason: 'banned' })], true);
    expect(notice?.title).toContain('Meta bloqueó');
    expect(notice?.detail).not.toContain('Reconéctalo');
  });

  it('warns a week before the connection with Meta expires, and when it did', () => {
    const now = new Date('2026-10-09T10:00:00-04:00');
    expect(channelNotices([channel({ accessExpiresAt: '2026-10-20T10:00:00-04:00' })], true, now)).toEqual([]);
    expect(channelNotices([channel({ accessExpiresAt: '2026-10-12T10:00:00-04:00' })], true, now)[0]?.title).toContain('vence en 3 días');
    expect(channelNotices([channel({ accessExpiresAt: '2026-10-08T10:00:00-04:00' })], true, now)[0]?.title).toContain('venció');
  });

  it('warns about a restricted number', () => {
    expect(channelNotices([channel({ status: 'restricted' })], true)[0]?.title).toContain('Meta restringió');
  });
});
