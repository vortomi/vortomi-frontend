import { httpResource } from '@angular/common/http';
import { type WritableSignal, inject, linkedSignal, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import type { Id } from './models';
import { type MockTable, mockTableUrl } from './mock-db';

export interface EditableTable<T extends { id: Id }> {
  /** Every row of every company; screens scope them by tenant when reading. */
  readonly rows: WritableSignal<T[]>;
  status(): string;
  upsert(row: T): void;
  patch(id: Id, patch: Partial<T>): void;
  remove(id: Id): void;
  /** 'api' mode: the server's rows replace what the table had, and the table counts as loaded. */
  replaceAll(rows: T[]): void;
}

/**
 * One table of the panel. 'mock' mode loads it from public/data and keeps edits in
 * memory; 'api' mode starts empty and is filled from the server (core/remote).
 * Keeping all companies' rows (not only the active one) means edits survive switching
 * company. Call in an injection context.
 */
export function editableTable<T extends { id: Id }>(table: MockTable): EditableTable<T> {
  const mock = inject(API_CONFIG).mode === 'mock';
  const resource = httpResource<T[]>(() => (mock ? mockTableUrl(table) : undefined), { defaultValue: [] });
  const rows = linkedSignal(() => resource.value());
  // 'idle' until the server answered once; then 'local', which allLoaded() accepts.
  const remoteStatus = signal<'idle' | 'local'>('idle');
  return {
    rows,
    status: () => (mock ? resource.status() : remoteStatus()),
    upsert: (row) =>
      rows.update((list) => (list.some((r) => r.id === row.id) ? list.map((r) => (r.id === row.id ? row : r)) : [...list, row])),
    patch: (id, patch) => rows.update((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    remove: (id) => rows.update((list) => list.filter((r) => r.id !== id)),
    replaceAll: (next) => {
      rows.set(next);
      remoteStatus.set('local');
    },
  };
}
