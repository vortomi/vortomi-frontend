import { Injectable, computed, inject } from '@angular/core';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { Contact, ContactAttribute, Id } from '../../shared/api/models';
import { allLoaded, newId } from '../../shared/api/mock-db';
import { editableTable } from '../../shared/api/editable-table';
import { formatWaId } from '../../shared/format/phone';
import type { ImportRow } from './contact-import';
import { visibleContacts } from './contacts.rules';

export interface NewContact {
  name: string;
  waId: string;
  channelAccountId: Id;
  ownerUserId: Id | null;
  stageId: Id | null;
  tagIds: Id[];
  attributes: ContactAttribute[];
  quoteCents?: number | null;
}

/** Contacts of the active company. Shared by the inbox card and the contacts screen. */
@Injectable({ providedIn: 'root' })
export class ContactsData {
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly table = editableTable<Contact>('contacts');

  readonly ready = computed(() => allLoaded(this.table));
  readonly all = computed(() => {
    const tenantId = this.session.tenant()?.id;
    return this.table.rows().filter((c) => c.tenantId === tenantId);
  });
  readonly byId = computed(() => new Map(this.all().map((c) => [c.id, c])));
  readonly visible = computed(() => visibleContacts(this.all(), this.session.membership()));

  update(id: Id, patch: Partial<Omit<Contact, 'id' | 'tenantId'>>): void {
    this.table.patch(id, patch);
  }

  setStage(id: Id, stageId: Id | null): void {
    this.table.patch(id, { stageId });
  }

  addTag(id: Id, tagId: Id): void {
    const contact = this.byId().get(id);
    if (contact && !contact.tagIds.includes(tagId)) this.table.patch(id, { tagIds: [...contact.tagIds, tagId] });
  }

  removeTag(id: Id, tagId: Id): void {
    const contact = this.byId().get(id);
    if (contact) this.table.patch(id, { tagIds: contact.tagIds.filter((t) => t !== tagId) });
  }

  /** Callers check duplicates first (findDuplicate); the backend enforces it with a UNIQUE key. */
  create(input: NewContact): Contact {
    const contact: Contact = {
      ...input,
      id: newId('con'),
      tenantId: this.session.tenant()?.id ?? '',
      phone: formatWaId(input.waId),
      purchasesCount: 0,
      purchasesTotalCents: 0,
      createdAt: this.clock.now().toISOString(),
    };
    this.table.upsert(contact);
    return contact;
  }

  /** Applies an analysed import: creates new rows, adds tags to existing ones, skips errors. */
  applyImport(rows: ImportRow[], channelId: Id): { created: number; updated: number } {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      if (row.status === 'error' || !row.waId) continue;
      const existing = this.all().find((c) => c.channelAccountId === channelId && c.waId === row.waId);
      if (existing) {
        this.table.patch(existing.id, { tagIds: [...new Set([...existing.tagIds, ...row.tagIds])] });
        updated++;
      } else {
        this.create({ name: row.name, waId: row.waId, channelAccountId: channelId, ownerUserId: null, stageId: null, tagIds: row.tagIds, attributes: [] });
        created++;
      }
    }
    return { created, updated };
  }
}
