import type { CustomField } from '../../shared/api/models';
import { appliesTo, cleanValues, formatValue, matchesFilter, missingRequired, noteKey } from './custom-field-rules';

const field = (overrides: Partial<CustomField>): CustomField => ({
  id: 'f', tenantId: 't', entity: 'product', label: 'Dato', kind: 'text', required: false, position: 0, options: [], categoryIds: [], ...overrides,
});

const fits = field({
  id: 'fits', label: 'Sirve para', kind: 'multi_choice', required: true, categoryIds: ['frenos'],
  options: [{ id: 'c15', value: 'Corolla 2015' }, { id: 'y18', value: 'Yaris 2018' }],
});
const side = field({ id: 'side', label: 'Lado', kind: 'choice', options: [{ id: 'l', value: 'Izquierdo' }, { id: 'r', value: 'Derecho' }] });
const wholesale = field({ id: 'w', entity: 'contact', label: 'Mayorista', kind: 'boolean' });
const birthday = field({ id: 'b', entity: 'contact', label: 'Cumpleaños', kind: 'date' });

describe('company fields', () => {
  it('a product field shows only in its categories; customer fields always', () => {
    expect(appliesTo(fits, 'frenos')).toBe(true);
    expect(appliesTo(fits, 'filtros')).toBe(false);
    expect(appliesTo(fits, null)).toBe(false);
    expect(appliesTo(side, null)).toBe(true);
    expect(appliesTo(wholesale, undefined)).toBe(true);
  });

  it('reads answers as people do', () => {
    expect(formatValue(fits, ['c15', 'y18'])).toBe('Corolla 2015, Yaris 2018');
    expect(formatValue(side, 'r')).toBe('Derecho');
    expect(formatValue(wholesale, false)).toBe('No');
    expect(formatValue(birthday, '1990-03-14')).toBe('14/03/1990');
    expect(formatValue(field({ kind: 'number' }), 1200.5)).toBe('1.200,5');
    expect(formatValue(side, undefined)).toBe('—');
  });

  it('sends only answers that apply, without empty ones or options taken off the list', () => {
    const values = { fits: ['c15', 'gone'], side: 'gone', other: 'x', w: true };
    expect(cleanValues([fits, side], values, 'frenos')).toEqual({ fits: ['c15'] });
    expect(cleanValues([fits, side], { fits: ['c15'], side: 'l' }, 'filtros')).toEqual({ side: 'l' });
  });

  it('asks for required fields that apply', () => {
    expect(missingRequired([fits, side], {}, 'frenos')).toEqual(['Falta «Sirve para».']);
    expect(missingRequired([fits, side], {}, 'filtros')).toEqual([]);
    expect(missingRequired([fits], { fits: ['c15'] }, 'frenos')).toEqual([]);
  });

  it('filters by an option, yes or no, or text inside', () => {
    expect(matchesFilter(fits, ['c15', 'y18'], 'y18')).toBe(true);
    expect(matchesFilter(side, 'l', 'r')).toBe(false);
    expect(matchesFilter(wholesale, true, 'true')).toBe(true);
    expect(matchesFilter(field({ kind: 'text' }), 'Av. Bolívar 12', 'bolivar')).toBe(true);
    expect(matchesFilter(birthday, '1990-03-14', '03/1990')).toBe(true);
    expect(matchesFilter(side, undefined, 'l')).toBe(false);
  });

  it('notes named alike are the same note', () => {
    expect(noteKey('Dirección:')).toBe(noteKey('direccion'));
    expect(noteKey('Dir.')).not.toBe(noteKey('Dirección'));
  });
});
