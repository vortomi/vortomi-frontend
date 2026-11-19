import type { ApiChannelApps } from '../../shared/api/contract';
import { appsCheckedText, sampleChannelApps, sortedApps } from './channel-apps.rules';

const NOW = new Date('2026-11-19T14:20:00Z');
const reading = (overrides: Partial<ApiChannelApps> = {}): ApiChannelApps => ({
  apps: [
    { id: '882956320901316', name: 'Vortex Autonomy', ours: false, firstSeenAt: '2026-11-19T13:15:00Z' },
    { id: '1167128472338629', name: 'Vortomi', ours: true, firstSeenAt: '2026-11-17T17:36:00Z' },
  ],
  appsCheckedAt: '2026-11-19T14:16:00Z',
  appsFailedAt: null,
  ...overrides,
});

describe('the apps of a number (mockup web-31)', () => {
  it('says when they were read, or that Meta did not answer the last time', () => {
    expect(appsCheckedText(reading(), NOW)).toBe('Revisado hace 4 min');
    expect(appsCheckedText(reading({ appsFailedAt: '2026-11-19T14:19:00Z' }), NOW)).toBe('No se pudo revisar · último intento hace 1 min');
    // An older failure, then a successful read: the read counts.
    expect(appsCheckedText(reading({ appsFailedAt: '2026-11-19T14:00:00Z' }), NOW)).toBe('Revisado hace 4 min');
    expect(appsCheckedText({ apps: null, appsCheckedAt: null, appsFailedAt: null }, NOW)).toBe('Todavía no se ha revisado');
  });

  it('ours first, then the foreign ones', () => {
    expect(sortedApps(reading()).map((a) => a.name)).toEqual(['Vortomi', 'Vortex Autonomy']);
  });

  it('the preview shows only our app', () => {
    expect(sampleChannelApps(NOW).apps?.every((a) => a.ours)).toBe(true);
  });
});
