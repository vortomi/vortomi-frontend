import { formatRemaining, getServiceWindow } from './service-window';

const NOW = new Date('2026-10-09T10:24:00-04:00');

describe('service window', () => {
  it('is open until the expiry and reports what is left', () => {
    const window = getServiceWindow('2026-10-10T10:15:00-04:00', NOW);
    expect(window.isOpen).toBe(true);
    expect(formatRemaining(window.remainingMs)).toBe('23 h 51 min');
  });

  it('is closed once the expiry has passed', () => {
    expect(getServiceWindow('2026-10-07T15:10:00-04:00', NOW)).toEqual({ isOpen: false, remainingMs: 0 });
  });

  it('is closed when the customer never wrote', () => {
    expect(getServiceWindow(null, NOW).isOpen).toBe(false);
  });

  it('formats short remainders', () => {
    expect(formatRemaining(45 * 60_000)).toBe('45 min');
    expect(formatRemaining(20_000)).toBe('menos de 1 min');
  });
});
