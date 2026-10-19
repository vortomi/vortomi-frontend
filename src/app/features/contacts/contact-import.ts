// Contact import from a spreadsheet: column guessing and row-by-row validation before saving.
import type { Contact, Id, Tag } from '../../shared/api/models';
import { toWaId } from '../../shared/format/phone';
import { findDuplicate } from './contacts.rules';

export type ImportField = 'name' | 'phone' | 'tags' | 'ignore';

export interface ImportRow {
  line: number;
  name: string;
  waId: string | null;
  tagIds: Id[];
  status: 'new' | 'update' | 'error';
  message: string;
}

export const MAX_IMPORT_ROWS = 2000;

const HEADER_HINTS: Record<Exclude<ImportField, 'ignore'>, string[]> = {
  name: ['nombre', 'name', 'cliente', 'contacto'],
  phone: ['telefono', 'phone', 'celular', 'whatsapp', 'numero', 'movil'],
  tags: ['etiquetas', 'etiqueta', 'tags', 'grupo'],
};

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function guessMapping(header: string[]): ImportField[] {
  const used = new Set<ImportField>();
  return header.map((title) => {
    const key = normalize(title);
    const field = (Object.keys(HEADER_HINTS) as Exclude<ImportField, 'ignore'>[]).find(
      (f) => !used.has(f) && HEADER_HINTS[f].some((hint) => key.includes(hint)),
    );
    if (!field) return 'ignore';
    used.add(field);
    return field;
  });
}

/** Validates every data row (header excluded) without saving anything. */
export function analyzeImport(
  rows: string[][],
  mapping: ImportField[],
  existing: Contact[],
  channelId: Id,
  tags: Tag[],
): ImportRow[] {
  const column = (field: ImportField) => mapping.indexOf(field);
  const nameCol = column('name');
  const phoneCol = column('phone');
  const tagCol = column('tags');
  const tagByName = new Map(tags.map((t) => [normalize(t.name), t.id]));
  const seen = new Map<string, number>();

  return rows.map((cells, index) => {
    const line = index + 2; // +1 for the header, +1 because people count from 1
    const name = (nameCol >= 0 ? cells[nameCol] : '')?.trim() ?? '';
    const waId = phoneCol >= 0 ? toWaId(cells[phoneCol] ?? '') : null;
    const tagNames = tagCol >= 0 ? (cells[tagCol] ?? '').split(/[,|/]/).map((t) => t.trim()).filter(Boolean) : [];
    const tagIds = tagNames.flatMap((t) => tagByName.get(normalize(t)) ?? []);
    const unknownTags = tagNames.filter((t) => !tagByName.has(normalize(t)));
    const base = { line, name, waId, tagIds };

    if (!name) return { ...base, status: 'error', message: 'Falta el nombre' };
    if (!waId) return { ...base, status: 'error', message: 'Teléfono no válido' };
    const firstLine = seen.get(waId);
    if (firstLine) return { ...base, status: 'error', message: `Repetido en el archivo (línea ${firstLine})` };
    seen.set(waId, line);

    const note = unknownTags.length ? ` · etiquetas que no existen: ${unknownTags.join(', ')}` : '';
    return findDuplicate(existing, channelId, waId)
      ? { ...base, status: 'update', message: `Ya existe: se agregan sus etiquetas${note}` }
      : { ...base, status: 'new', message: `Nuevo contacto${note}` };
  });
}
