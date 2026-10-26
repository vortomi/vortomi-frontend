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

  /**
   * Saves what changed. 'api' mode: name, stage and quote, and tags go to the server, each its
   * own request; the owner and free fields have no place there yet and stay as they were.
   * Resolves to whether everything that could be saved was.
   */
  async update(id: Id, patch: Partial<Omit<Contact, 'id' | 'tenantId'>>): Promise<boolean> {
    const current = this.byId().get(id);
    const remote = this.remote;
    if (!remote || !current) {
      this.table.patch(id, patch);
      return true;
    }
    const changed = (key: keyof typeof patch) => patch[key] !== undefined && JSON.stringify(patch[key]) !== JSON.stringify(current[key]);
    if (changed('ownerUserId') || changed('attributes')) {
      this.toaster.show('El responsable y los datos extra todavía no se guardan en el servidor. Lo demás sí se guarda.', 'info');
    }
    const steps: (() => Promise<boolean>)[] = [];
    if (changed('name')) {
      const name = patch.name!.trim() || null;
      steps.push(() => this.save(id, { name: patch.name! }, (r, tenantId) => r.rename(tenantId, id, name)));
    }
    if (changed('stageId') || changed('quoteCents')) {
      const stageId = patch.stageId === undefined ? current.stageId : patch.stageId;
      const quoteCents = patch.quoteCents === undefined ? current.quoteCents : patch.quoteCents;
      steps.push(() => this.save(id, { stageId, quoteCents }, (r, tenantId) => r.setOpportunity(tenantId, id, stageId, quoteCents ?? null)));
    }
    if (changed('tagIds')) steps.push(() => this.save(id, { tagIds: patch.tagIds! }, (r, tenantId) => r.setTags(tenantId, id, patch.tagIds!)));
    for (const step of steps) if (!(await step())) return false;
    return true;
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

  /** Server first; the screen changes only once the server accepted it. Resolves to whether it did. */
  private async save(id: Id, patch: Partial<Contact>, action: (remote: ContactsRemote, tenantId: Id) => Promise<unknown>): Promise<boolean> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return false;
    try {
      await action(this.remote, tenantId);
      this.table.patch(id, patch);
      return true;
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      return false;
    }
  }

  /**
   * Callers check duplicates first (findDuplicate); the backend enforces it with a UNIQUE key.
   * Resolves to the new contact, or null when the server refused it (its reason is shown).
   */
  async create(input: NewContact): Promise<Contact | null> {
    const tenantId = this.session.tenant()?.id;
    if (this.remote && tenantId) {
      try {
        const { channelAccountId, waId, name, stageId, tagIds } = input;
        let contact = await this.remote.create(tenantId, { channelAccountId, waId, name: name.trim() || null, stageId, tagIds });
        if (input.quoteCents) {
          await this.remote.setOpportunity(tenantId, contact.id, stageId, input.quoteCents);
          contact = { ...contact, quoteCents: input.quoteCents };
        }
        this.table.upsert(contact);
        return contact;
      } catch (error) {
        this.toaster.show(toApiFailure(error).message, 'info');
        return null;
      }
    }
    return this.createLocal(input);
  }

  private createLocal(input: NewContact): Contact {
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

  /**
   * Applies an analysed import: creates new rows, adds tags to existing ones, skips errors.
   * 'api' mode: one request for the whole list, then the list is read again. Null when refused.
   */
  async applyImport(rows: ImportRow[], channelId: Id): Promise<{ created: number; updated: number } | null> {
    const tenantId = this.session.tenant()?.id;
    if (this.remote && tenantId) {
      const valid = rows.flatMap((row) => (row.status !== 'error' && row.waId ? [{ waId: row.waId, name: row.name.trim() || null, tagIds: row.tagIds }] : []));
      if (!valid.length) return { created: 0, updated: 0 };
      try {
        const result = await this.remote.import(tenantId, channelId, valid);
        await this.load(tenantId);
        return result;
      } catch (error) {
        this.toaster.show(toApiFailure(error).message, 'info');
        return null;
      }
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
        this.createLocal({ name: row.name, waId: row.waId, channelAccountId: channelId, ownerUserId: null, stageId: null, tagIds: row.tagIds, attributes: [] });
        created++;
      }
    }
    return { created, updated };
  }
}
