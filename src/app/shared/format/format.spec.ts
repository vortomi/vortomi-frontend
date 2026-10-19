import { formatDayLabel, formatListStamp, formatMonthName, formatTime, relativeDay } from './date-time';
import { formatCount, formatUnitPrice, formatUsdCents } from './money';

const TZ = 'America/Caracas';
const NOW = new Date('2026-10-09T10:24:00-04:00');

describe('date-time', () => {
  it('formats hours in the tenant time zone, not the browser one', () => {
    expect(formatTime('2026-10-09T14:21:00Z', TZ)).toBe('10:21');
  });

  it('classifies today, yesterday and older days', () => {
    expect(relativeDay('2026-10-09T00:30:00-04:00', NOW, TZ)).toBe('today');
    expect(relativeDay('2026-10-08T23:59:00-04:00', NOW, TZ)).toBe('yesterday');
    expect(relativeDay('2026-10-06T15:10:00-04:00', NOW, TZ)).toBe('older');
  });

  it('uses the tenant day boundary: 01:00 UTC is still yesterday in Caracas', () => {
    expect(relativeDay('2026-10-09T01:00:00Z', NOW, TZ)).toBe('yesterday');
  });

  it('builds list stamps and day labels', () => {
    expect(formatListStamp('2026-10-09T10:21:00-04:00', NOW, TZ)).toBe('10:21');
    expect(formatListStamp('2026-10-08T18:05:00-04:00', NOW, TZ)).toBe('Ayer');
    expect(formatDayLabel('2026-10-09T10:21:00-04:00', NOW, TZ)).toBe('Hoy');
    expect(formatDayLabel('2026-10-06T15:10:00-04:00', NOW, TZ)).toBe('6 de octubre');
  });

  it('names the billing month', () => {
    expect(formatMonthName('2026-10')).toBe('octubre');
  });
});

describe('money', () => {
  it('shows whole dollars without decimals and cents with two', () => {
    expect(formatUsdCents(12600)).toBe('126 $');
    expect(formatUsdCents(184000)).toBe('1.840 $');
    expect(formatUsdCents(4550)).toBe('45,50 $');
  });

  it('keeps the three decimals of Meta prices', () => {
    expect(formatUnitPrice(0.011)).toBe('0,011 $');
  });

  it('groups thousands with dots', () => {
    expect(formatCount(38410)).toBe('38.410');
  });
});
