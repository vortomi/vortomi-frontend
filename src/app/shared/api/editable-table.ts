import { httpResource } from '@angular/common/http';
import { type WritableSignal, linkedSignal } from '@angular/core';
import type { Id } from './models';
import { type MockTable, mockTableUrl } from './mock-db';

export interface EditableTable<T extends { id: Id }> {
  /** Every row of every company; screens scope them by tenant when reading. */
  readonly rows: WritableSignal<T[]>;
  status(): string;
  upsert(row: T): void;
  patch(id: Id, patch: Partial<T>): void;
  remove(id: Id): void;
}

/**
 * One mock table: loaded from public/data and edited in memory. Keeping all companies' rows
 * (not only the active one) means edits survive switching company. Call in an injection context.
 */
export function editableTable<T extends { id: Id }>(table: MockTable): EditableTable<T> {
  const resource = httpResource<T[]>(() => mockTableUrl(table), { defaultValue: [] });
  const rows = linkedSignal(() => resource.value());
  return {
    rows,
    status: () => resource.status(),
    upsert: (row) =>
      rows.update((list) => (list.some((r) => r.id === row.id) ? list.map((r) => (r.id === row.id ? row : r)) : [...list, row])),
    patch: (id, patch) => rows.update((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    remove: (id) => rows.update((list) => list.filter((r) => r.id !== id)),
  };
}
