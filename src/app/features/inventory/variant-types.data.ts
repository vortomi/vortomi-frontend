import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { Id, VariantOption, VariantType } from '../../shared/api/models';
import { allLoaded, newId } from '../../shared/api/mock-db';
import { editableTable } from '../../shared/api/editable-table';
import { Toaster } from '../../shared/ui/toaster';
import { InventoryRemote } from './inventory-remote';

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A type with its values, sorted for the screens. */
export interface VariantTypeWithOptions {
  type: VariantType;
  options: VariantOption[];
}

/**
 * The active company's variant types (Marca, Talla...) and their values (Bosch, M...).
 * - 'mock': the JSON tables, with in-memory edits.
 * - 'api':  loaded from vortomi-backend; changes go to the server first. Each write resolves
 *           to whether it was saved, and shows the server's reason when not.
 */
@Injectable({ providedIn: 'root' })
export class VariantTypesData {
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(InventoryRemote) : null;
  private readonly typeTable = editableTable<VariantType>('variant-types');
  private readonly optionTable = editableTable<VariantOption>('variant-options');

  readonly ready = computed(() => allLoaded(this.typeTable, this.optionTable));
  private readonly tenantId = computed(() => this.session.tenant()?.id ?? '');

  readonly list = computed<VariantTypeWithOptions[]>(() => {
    const tenantId = this.tenantId();
    const options = this.optionTable.rows().filter((o) => o.tenantId === tenantId);
    return this.typeTable
      .rows()
      .filter((t) => t.tenantId === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((type) => ({
        type,
        options: options.filter((o) => o.typeId === type.id).sort((a, b) => a.value.localeCompare(b.value, 'es')),
      }));
  });
  readonly typeById = computed(() => new Map(this.list().map((t) => [t.type.id, t])));
  readonly optionById = computed(() => new Map(this.list().flatMap((t) => t.options.map((o) => [o.id, o] as const))));

  constructor() {
    if (!this.remote) return;
    effect(() => {
      const tenantId = this.session.tenant()?.id;
      if (tenantId) untracked(() => void this.load(tenantId));
    });
  }

  /** Same rule as the server: type names are unique per company, ignoring case. */
  typeNameTaken(name: string, exceptId: Id | null = null): boolean {
    return this.list().some(({ type }) => type.id !== exceptId && sameText(type.name, name));
  }

  /** Same rule as the server: values are unique inside their type, ignoring case. */
  valueTaken(typeId: Id, value: string, exceptId: Id | null = null): boolean {
    return (this.typeById().get(typeId)?.options ?? []).some((o) => o.id !== exceptId && sameText(o.value, value));
  }

  createType(name: string): Promise<boolean> {
    const remote = this.remote;
    if (remote) return this.write(async (tenantId) => this.typeTable.upsert(await remote.createVariantType(tenantId, name.trim())));
    this.typeTable.upsert({ id: newId('vty'), tenantId: this.tenantId(), name: name.trim() });
    return Promise.resolve(true);
  }

  renameType(id: Id, name: string): Promise<boolean> {
    const remote = this.remote;
    if (remote) return this.write(async (tenantId) => this.typeTable.upsert(await remote.renameVariantType(tenantId, id, name.trim())));
    this.typeTable.patch(id, { name: name.trim() });
    return Promise.resolve(true);
  }

  /** Takes its values along. Callers check first that nothing uses it; the server refuses it too. */
  removeType(id: Id): Promise<boolean> {
    const remote = this.remote;
    const drop = () => {
      this.typeTable.remove(id);
      this.optionTable.rows.update((rows) => rows.filter((o) => o.typeId !== id));
    };
    if (remote) return this.write(async (tenantId) => {
      await remote.removeVariantType(tenantId, id);
      drop();
    });
    drop();
    return Promise.resolve(true);
  }

  addValue(typeId: Id, value: string): Promise<boolean> {
    const remote = this.remote;
    if (remote) return this.write(async (tenantId) => this.optionTable.upsert(await remote.addVariantOption(tenantId, typeId, value.trim())));
    this.optionTable.upsert({ id: newId('vop'), tenantId: this.tenantId(), typeId, value: value.trim() });
    return Promise.resolve(true);
  }

  /** The variants that use it show the new value at once: their name is read from here. */
  renameValue(option: VariantOption, value: string): Promise<boolean> {
    const remote = this.remote;
    if (remote) return this.write(async (tenantId) => this.optionTable.upsert(await remote.renameVariantOption(tenantId, option, value.trim())));
    this.optionTable.patch(option.id, { value: value.trim() });
    return Promise.resolve(true);
  }

  removeValue(id: Id): Promise<boolean> {
    const remote = this.remote;
    if (remote) return this.write(async (tenantId) => {
      await remote.removeVariantOption(tenantId, id);
      this.optionTable.remove(id);
    });
    this.optionTable.remove(id);
    return Promise.resolve(true);
  }

  private async load(tenantId: Id): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    await this.write(async () => {
      const { types, options } = await remote.variantTypes(tenantId);
      this.typeTable.replaceAll(types);
      this.optionTable.replaceAll(options);
    });
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
