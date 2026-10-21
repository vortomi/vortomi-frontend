import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { Contact, ContactAttribute, Id } from '../../shared/api/models';
import { allLoaded, newId } from '../../shared/api/mock-db';
import { editableTable } from '../../shared/api/editable-table';
import { formatWaId } from '../../shared/format/phone';
import { Toaster } from '../../shared/ui/toaster';
import { ContactsRemote } from './contacts-remote';
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

/**
 * Contacts of the active company. Shared by the inbox card and the contacts screen.
 * 'api' mode: loaded from vortomi-backend; stage, tags and name changes go to the server first.
 */
@Injectable({ providedIn: 'root' })
export class ContactsData {
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly toaster = inject(Toaster);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(ContactsRemote) : null;
  private readonly table = editableTable<Contact>('contacts');

  readonly ready = computed(() => allLoaded(this.table));
  readonly all = computed(() => {
    const tenantId = this.session.tenant()?.id;
    return this.table.rows().filter((c) => c.tenantId === tenantId);
  });
  readonly byId = computed(() => new Map(this.all().map((c) => [c.id, c])));
  readonly visible = computed(() => visibleContacts(this.all(), this.session.membership()));

  constructor() {
    if (!this.remote) return;
    effect(() => {
      const tenantId = this.session.tenant()?.id;
      if (tenantId) untracked(() => void this.load(tenantId));
    });
  }

  /** Contacts that came inside conversations: added only when the full row is not here yet. */
  mergeRemote(stubs: Contact[]): void {
    const known = new Set(this.table.rows().map((c) => c.id));
    this.table.replaceAll([...this.table.rows(), ...stubs.filter((c) => !known.has(c.id))]);
  }

  update(id: Id, patch: Partial<Omit<Contact, 'id' | 'tenantId'>>): void {
    if (this.remote) {
      // The server keeps the name for now; owner and free fields arrive with milestone B7 (doc. 09).
      if (patch.name === undefined || Object.keys(patch).length > 1) return this.notYet();
      const name = patch.name.trim() || null;
      return void this.save(id, { name: patch.name }, (remote, tenantId) => remote.rename(tenantId, id, name));
    }
    this.table.patch(id, patch);
  }

  setStage(id: Id, stageId: Id | null): void {
    const quoteCents = this.byId().get(id)?.quoteCents ?? null;
    if (this.remote) return void this.save(id, { stageId }, (remote, tenantId) => remote.setOpportunity(tenantId, id, stageId, quoteCents));
    this.table.patch(id, { stageId });
  }

  addTag(id: Id, tagId: Id): void {
    const contact = this.byId().get(id);
    if (contact && !contact.tagIds.includes(tagId)) this.setTags(id, [...contact.tagIds, tagId]);
  }

  removeTag(id: Id, tagId: Id): void {
    const contact = this.byId().get(id);
    if (contact) this.setTags(id, contact.tagIds.filter((t) => t !== tagId));
  }

  private setTags(id: Id, tagIds: Id[]): void {
    if (this.remote) return void this.save(id, { tagIds }, (remote, tenantId) => remote.setTags(tenantId, id, tagIds));
    this.table.patch(id, { tagIds });
  }

  private async load(tenantId: Id): Promise<void> {
    if (!this.remote) return;
    try {
      const full = await this.remote.list(tenantId);
      const ids = new Set(full.map((c) => c.id));
      // Full rows win over stubs; contacts outside this page (stubs) stay.
      this.table.replaceAll([...this.table.rows().filter((c) => !ids.has(c.id)), ...full]);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    }
  }

  /** Server first; the screen changes only once the server accepted it. */
  private async save(id: Id, patch: Partial<Contact>, action: (remote: ContactsRemote, tenantId: Id) => Promise<unknown>): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    try {
      await action(this.remote, tenantId);
      this.table.patch(id, patch);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    }
  }

  private notYet(): void {
    this.toaster.show('Esto todavía no se guarda en el servidor. Llega con la próxima versión.', 'info');
  }

  /** Callers check duplicates first (findDuplicate); the backend enforces it with a UNIQUE key. */
  create(input: NewContact): Contact {
    if (this.remote) this.notYet();
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
    if (this.remote) {
      this.notYet();
      return { created: 0, updated: 0 };
    }
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
