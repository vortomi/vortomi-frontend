import { fullWeek, hoursError, logoError, nameError, shortcutError, stageDeleteError } from './settings.rules';

describe('settings rules', () => {
  it('validates quick reply shortcuts', () => {
    expect(shortcutError('pago', [])).toBeNull();
    expect(shortcutError('Pago', [])).toContain('minúsculas');
    expect(shortcutError('pago', ['pago'])).toContain('Ya existe');
  });

  it('compares names without case or accents', () => {
    expect(nameError('garantia', ['Garantía'])).toContain('Ya existe');
    expect(nameError('  ', [])).toContain('Escribe');
  });

  it('checks opening hours', () => {
    expect(hoursError({ day: 1, open: '08:00', close: '17:00' })).toBeNull();
    expect(hoursError({ day: 1, open: '17:00', close: '08:00' })).toContain('después');
    expect(hoursError({ day: 0, open: null, close: null })).toBeNull();
  });

  it('always lists the seven days, Monday first', () => {
    const week = fullWeek([{ day: 0, open: '09:00', close: '13:00' }]);
    expect(week.map((h) => h.day)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(week[6]).toEqual({ day: 0, open: '09:00', close: '13:00' });
    expect(week[0]).toEqual({ day: 1, open: null, close: null });
  });

  it('accepts only small raster logos, never SVG', () => {
    expect(logoError({ type: 'image/png', size: 100_000 })).toBeNull();
    expect(logoError({ type: 'image/svg+xml', size: 1_000 })).toContain('PNG');
    expect(logoError({ type: 'image/jpeg', size: 900_000 })).toContain('500 KB');
  });

  it('protects stages that still have contacts', () => {
    expect(stageDeleteError(3)).toContain('3 contactos');
    expect(stageDeleteError(0)).toBeNull();
  });
});
