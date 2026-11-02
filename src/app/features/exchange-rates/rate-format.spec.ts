import { formatIsoDay, formatRate, normalizeRate, rateInUse, weekdayOf } from './rate-format';

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

describe('rate in use', () => {
  const history = [{ bsPerUsd: '900.00000000', previousBsPerUsd: null, effectiveDate: '2026-10-27', changedBy: null, createdAt: '2026-10-27T04:13:00.000Z', source: 'bcv' as const }];

  it("is the company's own system rate while it is chosen, else the newest of the history", () => {
    const system = { useSystemRate: true, bsPerUsd: '888.12', rateDate: '2026-10-28T23:10:27.773Z' };
    expect(rateInUse({ system, exchangeRates: history })).toBe('888.12');
    expect(rateInUse({ system: { ...system, useSystemRate: false }, exchangeRates: history })).toBe('900.00000000');
    expect(rateInUse({ system: null, exchangeRates: history })).toBe('900.00000000');
    expect(rateInUse({ system: { ...system, bsPerUsd: null }, exchangeRates: history })).toBeNull();
  });
});
