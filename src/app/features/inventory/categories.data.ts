import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { Id, ProductCategory } from '../../shared/api/models';
import { allLoaded, newId } from '../../shared/api/mock-db';
import { editableTable } from '../../shared/api/editable-table';
import { Toaster } from '../../shared/ui/toaster';
import { InventoryRemote } from './inventory-remote';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The active company's product categories: the list products pick from.
 * - 'mock': the JSON table, with in-memory edits.
 * - 'api':  loaded from vortomi-backend; changes go to the server first. Each write
 *           resolves to whether it was saved, and shows the server's reason when not.
 */
@Injectable({ providedIn: 'root' })
export class CategoriesData {
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(InventoryRemote) : null;
  private readonly table = editableTable<ProductCategory>('product-categories');

  readonly ready = computed(() => allLoaded(this.table));
  readonly list = computed(() => {
    const tenantId = this.session.tenant()?.id;
    return this.table
      .rows()
      .filter((c) => c.tenantId === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });
  readonly byId = computed(() => new Map(this.list().map((c) => [c.id, c])));

  constructor() {
    if (!this.remote) return;
    effect(() => {
      const tenantId = this.session.tenant()?.id;
      if (tenantId) untracked(() => void this.load(tenantId));
    });
  }

  /** Same rule as the server: names are unique per company, ignoring case. */
  nameTaken(name: string, exceptId: Id | null = null): boolean {
    return this.list().some((c) => c.id !== exceptId && sameName(c.name, name));
  }

  create(name: string): Promise<boolean> {
    const remote = this.remote;
    if (remote) return this.write(async (tenantId) => this.table.upsert(await remote.createCategory(tenantId, name.trim())));
    this.table.upsert({ id: newId('cat'), tenantId: this.session.tenant()?.id ?? '', name: name.trim() });
    return Promise.resolve(true);
  }

  rename(id: Id, name: string): Promise<boolean> {
    const remote = this.remote;
    if (remote) return this.write(async (tenantId) => this.table.upsert(await remote.updateCategory(tenantId, id, name.trim())));
    this.table.patch(id, { name: name.trim() });
    return Promise.resolve(true);
  }

  /** Callers check first that no product uses it; the server refuses it too (category_in_use). */
  remove(id: Id): Promise<boolean> {
    const remote = this.remote;
    if (remote) return this.write(async (tenantId) => {
      await remote.removeCategory(tenantId, id);
      this.table.remove(id);
    });
    this.table.remove(id);
    return Promise.resolve(true);
  }

  /** 'mock' import: the category with that name, created when it does not exist yet. */
  ensureLocal(name: string): Id {
    const existing = this.list().find((c) => sameName(c.name, name));
    if (existing) return existing.id;
    const id = newId('cat');
    this.table.upsert({ id, tenantId: this.session.tenant()?.id ?? '', name: name.trim() });
    return id;
  }

  private async load(tenantId: Id): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    await this.write(async () => this.table.replaceAll(await remote.categories(tenantId)));
  }

  private async write(work: (tenantId: Id) => Promise<void>): Promise<boolean> {
    const tenantId = this.session.tenant()?.id;
    if (!tenantId) return false;
    try {
      await work(tenantId);
      return true;
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      return false;
    }
  }
}
