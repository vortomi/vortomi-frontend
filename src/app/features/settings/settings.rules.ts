// Pure validation for the company settings screens.
import type { DayHours } from '../../shared/api/models';
import { imageFileError } from '../../shared/files/image';

export const LOGO_MAX_BYTES = 500_000;

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function shortcutError(shortcut: string, taken: string[]): string | null {
  if (!/^[a-z0-9_-]{2,20}$/.test(shortcut)) return 'De 2 a 20 caracteres: minúsculas, números, guion o guion bajo.';
  if (taken.includes(shortcut)) return `Ya existe /${shortcut}.`;
  return null;
}

/** Names compare without case or accents: "Garantía" and "garantia" are the same tag. */
export function nameError(name: string, taken: string[]): string | null {
  if (!name.trim()) return 'Escribe un nombre.';
  if (taken.some((t) => normalize(t) === normalize(name))) return 'Ya existe uno con ese nombre.';
  return null;
}

/** Monday first, as the week reads in Venezuela. */
const WEEK_ORDER: DayHours['day'][] = [1, 2, 3, 4, 5, 6, 0];

/** Always the seven days, in order: a company that never saved its hours sees them all closed. */
export function fullWeek(hours: DayHours[]): DayHours[] {
  return WEEK_ORDER.map((day) => hours.find((h) => h.day === day) ?? { day, open: null, close: null });
}

export function hoursError(hours: DayHours): string | null {
  if (hours.open === null || hours.close === null) return null;
  return hours.open < hours.close ? null : 'La hora de cierre debe ser después de la de apertura.';
}

export function logoError(file: { type: string; size: number }): string | null {
  return imageFileError(file, LOGO_MAX_BYTES);
}

/** A stage with contacts cannot be deleted: they would be left without a stage silently. */
export function stageDeleteError(contactsInStage: number): string | null {
  return contactsInStage > 0 ? `Tiene ${contactsInStage} contactos. Muévelos a otra etapa primero.` : null;
}
