// How a product is sold (documentations/05): a closed list the platform keeps, the same as the
// server's (vortomi-backend src/db/schema/enums.ts). Companies pick, never type.
import type { SaleUnit } from '../../shared/api/models';

interface SaleUnitText {
  /** What the selector shows: "Kilo". */
  label: string;
  /** After a price: "$ 4,50 el kilo". */
  per: string;
  /** After a quantity: "1 caja", "12 cajas", "12,5 kg". */
  one: string;
  many: string;
}

export const SALE_UNIT: Record<SaleUnit, SaleUnitText> = {
  unit: { label: 'Unidad', per: 'la unidad', one: 'unidad', many: 'unidades' },
  pair: { label: 'Par', per: 'el par', one: 'par', many: 'pares' },
  dozen: { label: 'Docena', per: 'la docena', one: 'docena', many: 'docenas' },
  box: { label: 'Caja', per: 'la caja', one: 'caja', many: 'cajas' },
  pack: { label: 'Paquete', per: 'el paquete', one: 'paquete', many: 'paquetes' },
  roll: { label: 'Rollo', per: 'el rollo', one: 'rollo', many: 'rollos' },
  kg: { label: 'Kilo', per: 'el kilo', one: 'kg', many: 'kg' },
  g: { label: 'Gramo', per: 'el gramo', one: 'g', many: 'g' },
  m: { label: 'Metro', per: 'el metro', one: 'm', many: 'm' },
  m2: { label: 'Metro cuadrado', per: 'el metro cuadrado', one: 'm²', many: 'm²' },
  l: { label: 'Litro', per: 'el litro', one: 'L', many: 'L' },
  hour: { label: 'Hora', per: 'la hora', one: 'hora', many: 'horas' },
  service: { label: 'Servicio', per: 'el servicio', one: 'servicio', many: 'servicios' },
  session: { label: 'Sesión', per: 'la sesión', one: 'sesión', many: 'sesiones' },
};

export const SALE_UNIT_GROUPS: { title: string; units: SaleUnit[] }[] = [
  { title: 'Piezas', units: ['unit', 'pair', 'dozen', 'box', 'pack', 'roll'] },
  { title: 'Peso', units: ['kg', 'g'] },
  { title: 'Medida', units: ['m', 'm2', 'l'] },
  { title: 'Tiempo', units: ['hour', 'service', 'session'] },
];

/** Weight, length, area, volume and hours count fractions; pieces, grams and visits count whole. */
const DECIMAL_UNITS: readonly SaleUnit[] = ['kg', 'm', 'm2', 'l', 'hour'];

/** The choices for «Venta mínima» and «De cuánto en cuánto» (the server accepts only these). */
const MIN_QUANTITIES = [0.1, 0.25, 0.5, 1, 2, 3, 5, 6, 10, 12];
const QUANTITY_STEPS = [0.1, 0.25, 0.5, 1];

const NUMBER = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 3 });

export function takesDecimals(unit: SaleUnit): boolean {
  return DECIMAL_UNITS.includes(unit);
}

/** Steps that fit the unit: one at a time for what counts whole. */
export function stepChoices(unit: SaleUnit): number[] {
  return takesDecimals(unit) ? QUANTITY_STEPS : [1];
}

/** Minimums that fit the unit and the step: whole for what counts whole, whole steps for the rest. */
export function minChoices(unit: SaleUnit, step: number): number[] {
  return MIN_QUANTITIES.filter((min) => (takesDecimals(unit) ? isWhole(min / step) : Number.isInteger(min)));
}

/** "12,5"; up to 3 decimals, rounded so 0,1 + 0,2 shows as 0,3. */
export function formatNumber(value: number): string {
  return NUMBER.format(roundQuantity(value));
}

/** "1 caja", "12 cajas", "12,5 kg". */
export function formatQuantity(value: number, unit: SaleUnit): string {
  const text = SALE_UNIT[unit];
  return `${formatNumber(value)} ${roundQuantity(value) === 1 ? text.one : text.many}`;
}

/** "el kilo" after a price; nothing for plain units, where it goes without saying. */
export function perUnit(unit: SaleUnit): string {
  return unit === 'unit' ? '' : SALE_UNIT[unit].per;
}

/** What a person typed ("12,5"), as a quantity of that unit; null when it does not fit it. */
export function parseQuantity(raw: string | number, unit: SaleUnit): number | null {
  const text = String(raw).trim().replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,3})?$/.test(text)) return null;
  const value = Number(text);
  return takesDecimals(unit) || Number.isInteger(value) ? value : null;
}

/** Quantities keep 3 decimals, as the server does: sums of fractions never drift. */
export function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isWhole(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 1e-9;
}
