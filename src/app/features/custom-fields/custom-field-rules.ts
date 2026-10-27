// The company's own data about products and customers (block B): pure rules, tested without
// Angular. The server checks the same (vortomi-backend src/modules/custom-fields).
import type { CustomField, CustomFieldEntity, CustomFieldKind, CustomValue, CustomValues, Id } from '../../shared/api/models';

export const MAX_FIELDS = 30;

export const KIND_LABEL: Record<CustomFieldKind, string> = {
  text: 'Texto corto',
  number: 'Número',
  choice: 'Una de una lista',
  multi_choice: 'Varias de una lista',
  boolean: 'Sí o no',
  date: 'Fecha',
};

/** What each kind looks like, so the owner picks without guessing. */
export const KIND_EXAMPLE: Record<CustomFieldKind, string> = {
  text: 'Ej.: dirección de entrega',
  number: 'Ej.: garantía en meses',
  choice: 'Ej.: Lado → Izquierdo, Derecho',
  multi_choice: 'Ej.: Sirve para → Corolla 2015, Yaris 2018',
  boolean: 'Ej.: Cliente mayorista',
  date: 'Ej.: Cumpleaños',
};

export const isList = (kind: CustomFieldKind): boolean => kind === 'choice' || kind === 'multi_choice';

/** Ready-made ideas, taken with one click; the business type will suggest its own (block C). */
export const SUGGESTIONS: Record<CustomFieldEntity, { label: string; kind: CustomFieldKind; options?: string[] }[]> = {
  product: [
    { label: 'Marca', kind: 'choice', options: ['Marca 1', 'Marca 2'] },
    { label: 'Sirve para', kind: 'multi_choice', options: ['Modelo 1', 'Modelo 2'] },
    { label: 'Material', kind: 'text' },
    { label: 'Medidas', kind: 'text' },
    { label: 'Garantía (meses)', kind: 'number' },
    { label: 'Requiere récipe', kind: 'boolean' },
  ],
  contact: [
    { label: 'Zona', kind: 'choice', options: ['Centro', 'Norte', 'Sur'] },
    { label: 'Dirección de entrega', kind: 'text' },
    { label: 'Cumpleaños', kind: 'date' },
    { label: 'Cédula', kind: 'text' },
    { label: 'Cliente mayorista', kind: 'boolean' },
  ],
};

/** A product field shows in its categories only; with none, everywhere. Customer fields always. */
export function appliesTo(field: CustomField, categoryId: Id | null | undefined): boolean {
  return field.entity === 'contact' || !field.categoryIds.length || (!!categoryId && field.categoryIds.includes(categoryId));
}

export function isAnswered(value: CustomValue | undefined): boolean {
  return value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
}

/** "Corolla 2015, Yaris 2018", "Sí", "14/03/1990": a value as people read it. */
export function formatValue(field: CustomField, value: CustomValue | undefined): string {
  if (!isAnswered(value)) return '—';
  const option = (id: string) => field.options.find((o) => o.id === id)?.value ?? '';
  switch (field.kind) {
    case 'boolean':
      return value ? 'Sí' : 'No';
    case 'date':
      return String(value).split('-').reverse().join('/');
    case 'number':
      return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 3 }).format(Number(value));
    case 'choice':
      return option(String(value)) || '—';
    case 'multi_choice':
      return (value as string[]).map(option).filter(Boolean).join(', ') || '—';
    default:
      return String(value);
  }
}

/**
 * What is sent to the server: answers to fields that apply, without empty ones, and without
 * options that were taken off their list meanwhile.
 */
export function cleanValues(fields: CustomField[], values: CustomValues, categoryId?: Id | null): CustomValues {
  const kept: CustomValues = {};
  for (const field of fields) {
    let value = values[field.id];
    const known = new Set(field.options.map((o) => o.id));
    if (field.kind === 'choice' && !known.has(String(value))) value = undefined;
    if (field.kind === 'multi_choice' && Array.isArray(value)) value = value.filter((id) => known.has(id));
    if (appliesTo(field, categoryId) && isAnswered(value)) kept[field.id] = value!;
  }
  return kept;
}

/** "Falta «Sirve para»." for every required field that applies and has no answer. */
export function missingRequired(fields: CustomField[], values: CustomValues, categoryId?: Id | null): string[] {
  return fields.filter((f) => f.required && appliesTo(f, categoryId) && !isAnswered(values[f.id])).map((f) => `Falta «${f.label}».`);
}

/** One filter of the contact list: a field and the answer looked for. */
export interface FieldFilter {
  fieldId: Id;
  /** An option id, "true"/"false", or text to look for. */
  value: string;
}

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Whether an answer matches a filter: the option picked (or among those picked), yes/no, or text inside. */
export function matchesFilter(field: CustomField, value: CustomValue | undefined, filter: string): boolean {
  if (!isAnswered(value)) return false;
  switch (field.kind) {
    case 'multi_choice':
      return (value as string[]).includes(filter);
    case 'boolean':
      return String(value) === filter;
    case 'choice':
      return value === filter;
    default:
      return normalize(formatValue(field, value)).includes(normalize(filter));
  }
}

/** A note named "Dirección", "direccion" or "Dirección:" is the same one. */
export function noteKey(label: string): string {
  return normalize(label).replace(/[\s.:]+$/g, '').trim();
}
