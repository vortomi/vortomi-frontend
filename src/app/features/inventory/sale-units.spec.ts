import { formatQuantity, minChoices, parseQuantity, perUnit, stepChoices, takesDecimals } from './sale-units';
import { addValue, combinations, dropValue } from './variant-combinations';

describe('sale units', () => {
  it('fractions only where the unit takes them, with up to 3 decimals', () => {
    expect(takesDecimals('kg')).toBe(true);
    expect(takesDecimals('box')).toBe(false);
    expect(parseQuantity('12,5', 'kg')).toBe(12.5);
    expect(parseQuantity('12,5', 'unit')).toBeNull();
    expect(parseQuantity('0,1234', 'm')).toBeNull();
    expect(parseQuantity('-1', 'kg')).toBeNull();
    expect(parseQuantity('3', 'box')).toBe(3);
  });

  it('offers the minimums and steps that fit', () => {
    expect(stepChoices('unit')).toEqual([1]);
    expect(stepChoices('m')).toEqual([0.1, 0.25, 0.5, 1]);
    expect(minChoices('m', 0.25)).toEqual([0.25, 0.5, 1, 2, 3, 5, 6, 10, 12]);
    expect(minChoices('unit', 1)).toEqual([1, 2, 3, 5, 6, 10, 12]);
  });

  it('reads quantities and prices the Venezuelan way', () => {
    expect(formatQuantity(12.5, 'kg')).toBe('12,5 kg');
    expect(formatQuantity(1, 'box')).toBe('1 caja');
    expect(formatQuantity(0.1 + 0.2, 'm')).toBe('0,3 m');
    expect(formatQuantity(12, 'box')).toBe('12 cajas');
    expect(perUnit('kg')).toBe('el kilo');
    expect(perUnit('unit')).toBe('');
  });
});

describe('combined variants', () => {
  type Row = { id: string | null; optionIds: string[] };
  const blank = (optionIds: string[]): Row => ({ id: null, optionIds });

  it('every combination of one value of each type, in order', () => {
    expect(combinations([['S', 'M'], ['Rojo', 'Azul']])).toEqual([
      ['S', 'Rojo'],
      ['S', 'Azul'],
      ['M', 'Rojo'],
      ['M', 'Azul'],
    ]);
    expect(combinations([['S'], []])).toEqual([]);
  });

  it('picking a value adds its combinations; one taken away by hand stays away', () => {
    let rows: Row[] = addValue([], [['S'], ['Rojo']], 1, 'Rojo', blank);
    expect(rows.map((r) => r.optionIds)).toEqual([['S', 'Rojo']]);
    rows = addValue(rows, [['S', 'M'], ['Rojo']], 0, 'M', blank);
    rows = rows.filter((r) => r.optionIds.join() !== 'S,Rojo');
    rows = addValue(rows, [['S', 'M'], ['Rojo', 'Azul']], 1, 'Azul', blank);
    expect(rows.map((r) => r.optionIds.join('/'))).toEqual(['M/Rojo', 'S/Azul', 'M/Azul']);
  });

  it('dropping a value removes its new rows but never a saved one', () => {
    const rows: Row[] = [
      { id: 'v1', optionIds: ['S', 'Rojo'] },
      { id: null, optionIds: ['S', 'Azul'] },
      { id: null, optionIds: ['M', 'Azul'] },
    ];
    expect(dropValue(rows, 0, 'S').map((r) => r.optionIds.join('/'))).toEqual(['S/Rojo', 'M/Azul']);
  });
});
