import { parsePriceCents } from '../../../shared/format/money';
import type { Plan } from './plan.models';
import { EMPTY_DRAFT, changesOf, changesWhatTheyPay, companiesText, draftOf, percentOf, readDraft } from './plan.rules';

const plan: Plan = {
  id: 'p1',
  name: 'Equipo',
  description: 'Para equipos.',
  priceCents: 7900,
  discounts: { '1': 0, '3': 5, '6': 10, '12': 20 },
  benefits: ['3 números · 5 usuarios', 'Reportes del equipo'],
  isActive: true,
  companies: 2,
};

const read = (change: Partial<typeof EMPTY_DRAFT>, taken: string[] = []) =>
  readDraft({ ...EMPTY_DRAFT, name: 'Profesional', price: '149,00', ...change }, parsePriceCents, taken);

describe('reading the plan form', () => {
  it('sends the plan with its cents, whole percents and trimmed benefits', () => {
    expect(read({ description: '  Para sucursales. ', discounts: { '1': '', '3': '5', '6': '10', '12': '20' }, benefits: [' Soporte ', '', 'IA'] })).toEqual({
      input: {
        name: 'Profesional',
        description: 'Para sucursales.',
        priceCents: 14900,
        discounts: { '1': 0, '3': 5, '6': 10, '12': 20 },
        benefits: ['Soporte', 'IA'],
      },
    });
  });

  it('says the first thing to fix', () => {
    expect(read({ name: ' ' })).toEqual({ problem: 'Escribe el nombre del plan.' });
    expect(read({ name: 'equipo' }, ['Equipo'])).toEqual({ problem: 'Ya existe un plan llamado «equipo». Usa otro nombre.' });
    expect(read({ price: '0,00' })).toEqual({ problem: 'Escribe un precio base mayor que cero.' });
    expect(read({ discounts: { '1': '0', '3': '95', '6': '0', '12': '0' } })).toEqual({
      problem: 'El descuento de 3 meses debe ser un número entero del 0 al 90 %.',
    });
  });

  it('reads percents: empty is 0, decimals and over 90 are not', () => {
    expect(percentOf('')).toBe(0);
    expect(percentOf('15')).toBe(15);
    expect(percentOf('7,5')).toBeNull();
    expect(percentOf('91')).toBeNull();
  });

  it('fills the form back from a saved plan', () => {
    expect(draftOf(plan)).toMatchObject({ price: '79,00', discounts: { '1': '0', '3': '5', '6': '10', '12': '20' } });
  });
});

describe('what an edit changes', () => {
  it('lists every change and says when the companies pay something new', () => {
    const after = { ...plan, name: 'Equipo Plus', priceCents: 8900, discounts: { ...plan.discounts, '6': 12 }, benefits: [...plan.benefits, 'Soporte'] };
    expect(changesOf(plan, after)).toEqual([
      'Nombre: Equipo → Equipo Plus',
      'Precio base: 79,00 $ → 89,00 $ al mes',
      'Descuento de 6 meses: 10 % → 12 %',
      'Beneficios',
    ]);
    expect(changesWhatTheyPay(plan, after)).toBe(true);
    expect(changesWhatTheyPay(plan, { ...plan, description: 'Otra' })).toBe(false);
    expect(changesOf(plan, plan)).toEqual([]);
  });

  it('counts companies in words', () => {
    expect(companiesText(0)).toBe('Ninguna empresa');
    expect(companiesText(1)).toBe('1 empresa');
    expect(companiesText(3)).toBe('3 empresas');
  });
});
