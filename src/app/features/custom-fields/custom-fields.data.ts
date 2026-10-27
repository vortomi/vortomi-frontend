import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { CustomField, CustomFieldEntity, Id } from '../../shared/api/models';
import { allLoaded, newId } from '../../shared/api/mock-db';
import { editableTable } from '../../shared/api/editable-table';
import { Toaster } from '../../shared/ui/toaster';
import { ContactsData } from '../contacts/contacts.data';
import { noteKey } from './custom-field-rules';
import { CustomFieldsRemote, type FieldChanges, type NewField } from './custom-fields-remote';

/**
 * The active company's own fields for its products and customers (block B).
 * - 'mock': public/data/custom-fields.json, changes in memory.
 * - 'api':  read from the server; each change goes there first. Writes resolve to whether
 *           they were saved and show the server's reason when not.
 */
@Injectable({ providedIn: 'root' })
export class CustomFields {
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);
  private readonly contacts = inject(ContactsData);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(CustomFieldsRemote) : null;
  private readonly table = editableTable<CustomField>('custom-fields');

  readonly ready = computed(() => allLoaded(this.table));
  private readonly tenantId = computed(() => this.session.tenant()?.id ?? '');
  private readonly mine = computed(() =>
    this.table
      .rows()
      .filter((f) => f.tenantId === this.tenantId())
      .sort((a, b) => a.position - b.position),
  );
  readonly products = computed(() => this.mine().filter((f) => f.entity === 'product'));
  readonly customers = computed(() => this.mine().filter((f) => f.entity === 'contact'));

  constructor() {
    if (!this.remote) return;
    effect(() => {
      const tenantId = this.session.tenant()?.id;
      if (tenantId) untracked(() => void this.load(tenantId));
    });
  }

  of(entity: CustomFieldEntity): CustomField[] {
    return entity === 'product' ? this.products() : this.customers();
  }

  create(field: NewField): Promise<boolean> {
    return this.write(
      (remote, tenantId) => remote.create(tenantId, field),
      () => ({
        ...field,
        id: newId('fld'),
        tenantId: this.tenantId(),
        position: Math.max(-1, ...this.of(field.entity).map((f) => f.position)) + 1,
        options: field.options.map((value) => ({ id: newId('opt'), value })),
      }),
    );
  }

  update(id: Id, changes: FieldChanges): Promise<boolean> {
    const current = this.mine().find((f) => f.id === id);
    if (!current) return Promise.resolve(false);
    return this.write(
      (remote, tenantId) => remote.update(tenantId, id, changes),
      () => ({ ...current, ...changes, options: changes.options.map((o) => ({ id: o.id ?? newId('opt'), value: o.value })) }),
    );
  }

  /** The server also removes every answer given to it; here they simply stop showing. */
  async remove(id: Id): Promise<boolean> {
    if (this.remote) {
      try {
        await this.remote.remove(this.tenantId(), id);
      } catch (error) {
        this.toaster.show(toApiFailure(error).message, 'info');
        return false;
      }
    }
    this.table.remove(id);
    return true;
  }

  /** Notes typed on contacts before the fields existed, grouped by name, most used first. */
  async notes(): Promise<{ label: string; count: number }[]> {
    if (this.remote) {
      try {
        return await this.remote.notes(this.tenantId());
      } catch (error) {
        this.toaster.show(toApiFailure(error).message, 'info');
        return [];
      }
    }
    const groups = new Map<string, { label: string; count: number }>();
    for (const contact of this.contacts.all()) {
      for (const note of contact.attributes) {
        if (!note.value.trim()) continue;
        const group = groups.get(noteKey(note.label)) ?? { label: note.label.trim(), count: 0 };
        group.count++;
        groups.set(noteKey(note.label), group);
      }
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  }

  /** Turns the notes named `label` into a customers' text field. Resolves to how many moved, or null. */
  async organizeNotes(label: string): Promise<number | null> {
    if (this.remote) {
      try {
        const { field, moved } = await this.remote.organizeNotes(this.tenantId(), label);
        this.table.upsert(field);
        await this.contacts.reload();
        return moved;
      } catch (error) {
        this.toaster.show(toApiFailure(error).message, 'info');
        return null;
      }
    }
    const key = noteKey(label);
    let field = this.customers().find((f) => noteKey(f.label) === key);
    if (!field) {
      if (!(await this.create({ entity: 'contact', label: label.trim(), kind: 'text', required: false, options: [], categoryIds: [] }))) return null;
      field = this.customers().find((f) => noteKey(f.label) === key)!;
    }
    let moved = 0;
    for (const contact of this.contacts.all()) {
      const matching = contact.attributes.filter((n) => noteKey(n.label) === key);
      if (!matching.length) continue;
      const value = matching.map((n) => n.value.trim()).find(Boolean);
      const customValues = value && !(field.id in contact.customValues) ? { ...contact.customValues, [field.id]: value } : contact.customValues;
      if (customValues !== contact.customValues) moved++;
      await this.contacts.update(contact.id, { customValues, attributes: contact.attributes.filter((n) => noteKey(n.label) !== key) });
    }
    return moved;
  }

  private async load(tenantId: Id): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    try {
      const [products, contacts] = await Promise.all([remote.list(tenantId, 'product'), remote.list(tenantId, 'contact')]);
      this.table.replaceAll([...this.table.rows().filter((f) => f.tenantId !== tenantId), ...products, ...contacts]);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    }
  }

  private async write(send: (remote: CustomFieldsRemote, tenantId: Id) => Promise<CustomField>, local: () => CustomField): Promise<boolean> {
    try {
      this.table.upsert(this.remote ? await send(this.remote, this.tenantId()) : local());
      return true;
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      return false;
    }
  }
}
