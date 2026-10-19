import { formatWaId, toWaId } from './phone';

describe('toWaId', () => {
  it.each([
    ['0414-555-0187', '584145550187'],
    ['+58 414 555 0187', '584145550187'],
    ['4145550187', '584145550187'],
    ['(0212) 555-0188', '582125550188'],
  ])('normalises %s', (input, expected) => {
    expect(toWaId(input)).toBe(expected);
  });

  it('accepts foreign numbers written with +', () => {
    expect(toWaId('+57 300 123 4567')).toBe('573001234567');
  });

  it.each(['123', '0414-555', '0614-555-0187', 'hola'])('rejects %s', (input) => {
    expect(toWaId(input)).toBeNull();
  });
});

describe('formatWaId', () => {
  it('formats Venezuelan numbers the local way', () => {
    expect(formatWaId('584145550187')).toBe('+58 414-555-0187');
  });
});
