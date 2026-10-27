import { formatIsoDay, formatRate, normalizeRate, weekdayOf } from './rate-format';

describe('rate format', () => {
  it('normalizes what the admin types', () => {
    expect(normalizeRate('36,52')).toBe('36.52');
    expect(normalizeRate(' Bs. 886,2271 ')).toBe('886.2271');
    expect(normalizeRate('887.30200000')).toBe('887.30200000');
    expect(normalizeRate('0')).toBeNull();
    expect(normalizeRate('1.234,56')).toBeNull();
    expect(normalizeRate('36,123456789')).toBeNull();
    expect(normalizeRate('abc')).toBeNull();
  });

  it('shows rates and days the Venezuelan way', () => {
    expect(formatRate('887.30200000')).toBe('Bs 887,302');
    expect(formatRate('1200')).toBe('Bs 1.200,00');
    expect(formatIsoDay('2026-10-05')).toBe('05/10/2026');
    expect(weekdayOf('2026-10-27')).toBe('martes');
  });
});
