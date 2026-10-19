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
    expect(admin?.detail).toContain('Escríbenos');
    expect(agent?.detail).toContain('Avísale a la administración');
  });

  it('warns about a restricted number', () => {
    expect(channelNotices([channel({ status: 'restricted' })], true)[0]?.title).toContain('Meta restringió');
  });
});
