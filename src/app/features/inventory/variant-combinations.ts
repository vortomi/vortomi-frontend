// Combined variants (Talla x Color): every combination of the values picked for each type.
import type { Id } from '../../shared/api/models';

/** The same combination always has the same key, whatever row holds it. */
export const comboKey = (optionIds: readonly Id[]): string => optionIds.join('|');

/**
 * Every combination of one value of each list, in the lists' order: [[S, M], [Rojo, Azul]]
 * gives S/Rojo, S/Azul, M/Rojo, M/Azul. Nothing while a list is empty.
 */
export function combinations(lists: readonly (readonly Id[])[]): Id[][] {
  if (!lists.length || lists.some((list) => !list.length)) return [];
  return lists.reduce<Id[][]>((combos, list) => combos.flatMap((combo) => list.map((id) => [...combo, id])), [[]]);
}

/**
 * The rows after picking a value of the type at `typeIndex` (`picked` already includes it): the
 * combinations it makes with the values picked for the other types, added after the rows there
 * were. A combination the person took away by hand comes back only when they pick again.
 */
export function addValue<T extends { optionIds: Id[] }>(rows: readonly T[], picked: readonly (readonly Id[])[], typeIndex: number, optionId: Id, blank: (optionIds: Id[]) => T): T[] {
  const present = new Set(rows.map((row) => comboKey(row.optionIds)));
  const added = combinations(picked)
    .filter((combo) => combo[typeIndex] === optionId && !present.has(comboKey(combo)))
    .map(blank);
  return [...rows, ...added];
}

/** The rows after dropping a value: those that use it go, except saved ones (never deleted from here). */
export function dropValue<T extends { id: Id | null; optionIds: Id[] }>(rows: readonly T[], typeIndex: number, optionId: Id): T[] {
  return rows.filter((row) => row.id !== null || row.optionIds[typeIndex] !== optionId);
}
