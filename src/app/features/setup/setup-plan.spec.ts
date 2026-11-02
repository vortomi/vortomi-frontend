import { planLines } from './setup-plan';
import type { SetupPlan } from './setup.models';

const empty: SetupPlan = { workMode: null, saleDefaults: null, categories: [], productFields: [], contactFields: [], variantTypes: [], tags: [] };
const item = (name: string, exists = false, detail = '') => ({ name, detail, exists });

describe('the welcome summary', () => {
  it('says what each part adds and what is already there', () => {
    const lines = planLines({
      ...empty,
      saleDefaults: { defaultSaleUnit: 'kg', defaultStockMode: 'units' },
      categories: [item('Frenos', true), item('Filtros')],
      variantTypes: [item('Talla', false, 'S, M, L')],
    });
    expect(lines).toEqual([
      { part: 'saleDefaults', label: 'Productos nuevos', adds: 'Se venden por kilo, contando existencias', keeps: '' },
      { part: 'categories', label: 'Categorías', adds: 'Filtros', keeps: 'Frenos' },
      { part: 'variantTypes', label: 'Variantes', adds: 'Talla (S, M, L)', keeps: '' },
    ]);
  });

  it('a part the company already has entirely adds nothing', () => {
    expect(planLines({ ...empty, tags: [item('Mayorista', true)] })).toEqual([{ part: 'tags', label: 'Etiquetas', adds: '', keeps: 'Mayorista' }]);
  });

  it('only attending: the work mode, and long lists are cut short', () => {
    const many = Array.from({ length: 9 }, (_, i) => item(`Dato ${i + 1}`));
    const [mode, fields] = planLines({ ...empty, workMode: 'support_only', contactFields: many });
    expect(mode?.adds).toBe('Solo atención: se ocultan el inventario y el pipeline');
    expect(fields?.adds).toBe('Dato 1, Dato 2, Dato 3, Dato 4, Dato 5, Dato 6 y 3 más');
  });
});
