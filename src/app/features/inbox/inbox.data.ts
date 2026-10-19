import { Injectable, computed, inject } from '@angular/core';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { Conversation, Id, IsoDate, Message, MessageTemplate, Note } from '../../shared/api/models';
import { allLoaded, newId } from '../../shared/api/mock-db';
import { editableTable } from '../../shared/api/editable-table';
import { ContactsData } from '../contacts/contacts.data';
import { type InboxItem, visibleTo } from './inbox.filters';

export type TimelineEntry =
  | { kind: 'message'; at: IsoDate; message: Message }
  | { kind: 'note'; at: IsoDate; note: Note };

/** Simulated delivery receipt so a sent message visibly moves from ✓ to ✓✓. */
const FAKE_DELIVERY_MS = 1200;

/**
 * Inbox store. Reads the JSON tables and keeps in-memory edits (sent messages, notes,
 * assignments) until the page reloads. When the backend exists, only this file changes.
 */
@Injectable({ providedIn: 'root' })
export class InboxData {
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly contacts = inject(ContactsData);

  private readonly conversationTable = editableTable<Conversation>('conversations');
  private readonly messageTable = editableTable<Message>('messages');
  private readonly noteTable = editableTable<Note>('notes');

  // Scoped to the active company (tenant_id), as the backend will do.
  private readonly conversations = this.scoped(() => this.conversationTable.rows());
  private readonly messages = this.scoped(() => this.messageTable.rows());
  private readonly notes = this.scoped(() => this.noteTable.rows());

  readonly ready = computed(
    () =>
      this.session.ready() &&
      this.contacts.ready() &&
      allLoaded(this.conversationTable, this.messageTable, this.noteTable),
  );

  /** Conversations joined with their contact, limited to what the signed-in person may see. */
  readonly items = computed<InboxItem[]>(() => {
    const contacts = this.contacts.byId();
    const joined = this.conversations().flatMap((conversation) => {
      const contact = contacts.get(conversation.contactId);
      return contact ? [{ conversation, contact }] : [];
    });
    return visibleTo(joined, this.session.membership(), this.session.user()?.id ?? null);
  });

  readonly unreadTotal = computed(() =>
    this.items()
      .filter((i) => i.conversation.status === 'open')
      .reduce((sum, i) => sum + i.conversation.unreadCount, 0),
  );

  /** Latest conversation of each contact, for the contacts screen. */
  readonly conversationByContact = computed(() => {
    const map = new Map<Id, Conversation>();
    for (const conversation of this.conversations()) {
      const current = map.get(conversation.contactId);
      if (!current || conversation.lastMessageAt > current.lastMessageAt) map.set(conversation.contactId, conversation);
    }
    return map;
  });

  /** Last message of each conversation, to know who spoke last (pipeline waiting times). */
  readonly lastMessageByConversation = computed(() => {
    const map = new Map<Id, Message>();
    for (const message of this.messages()) {
      const current = map.get(message.conversationId);
      if (!current || message.createdAt > current.createdAt) map.set(message.conversationId, message);
    }
    return map;
  });

  findItem(conversationId: Id | undefined): InboxItem | null {
    return this.items().find((i) => i.conversation.id === conversationId) ?? null;
  }

  /** Messages and internal notes of one conversation, in time order. */
  timeline(conversationId: Id): TimelineEntry[] {
    const messages = this.messages()
      .filter((m) => m.conversationId === conversationId)
      .map((message): TimelineEntry => ({ kind: 'message', at: message.createdAt, message }));
    const notes = this.notes()
      .filter((n) => n.conversationId === conversationId)
      .map((note): TimelineEntry => ({ kind: 'note', at: note.createdAt, note }));
    return [...messages, ...notes].sort((a, b) => a.at.localeCompare(b.at));
  }

  sendText(conversationId: Id, body: string): void {
    this.appendOutbound(conversationId, { type: 'text', body, templateId: null }, body);
  }

  sendTemplate(conversationId: Id, template: MessageTemplate): void {
    const firstName = this.findItem(conversationId)?.contact.name.split(' ')[0] ?? '';
    const body = template.body.replace('{{1}}', firstName).replace(/\{\{\d+\}\}/g, '…');
    this.appendOutbound(conversationId, { type: 'template', body, templateId: template.id }, `Plantilla: ${body}`);
  }

  /** Product card from the inventory. Free-form message: needs the 24 h window open. */
  sendProduct(conversationId: Id, body: string, productVariantId: Id): void {
    const title = body.split('\n')[0] ?? body;
    this.appendOutbound(conversationId, { type: 'product', body, templateId: null, productVariantId }, `Producto: ${title}`);
  }

  addNote(conversationId: Id, body: string): void {
    const author = this.session.user();
    if (!author) return;
    this.noteTable.upsert({
      id: newId('note'),
      tenantId: this.tenantId(),
      conversationId,
      authorUserId: author.id,
      mentionUserId: this.findItem(conversationId)?.conversation.assignedUserId ?? null,
      body,
      createdAt: this.nowIso(),
    });
  }

  assign(conversationId: Id, userId: Id | null): void {
    this.conversationTable.patch(conversationId, { assignedUserId: userId });
  }

  toggleResolved(conversationId: Id): void {
    const current = this.findItem(conversationId)?.conversation.status;
    this.conversationTable.patch(conversationId, { status: current === 'resolved' ? 'open' : 'resolved' });
  }

  markRead(conversationId: Id): void {
    if (this.findItem(conversationId)?.conversation.unreadCount) {
      this.conversationTable.patch(conversationId, { unreadCount: 0 });
    }
  }

  private appendOutbound(
    conversationId: Id,
    content: Pick<Message, 'type' | 'body' | 'templateId' | 'productVariantId'>,
    preview: string,
  ): void {
    const message: Message = {
      id: newId('msg'),
      tenantId: this.tenantId(),
      conversationId,
      direction: 'outbound',
      authorUserId: this.session.user()?.id ?? null,
      status: 'sent',
      createdAt: this.nowIso(),
      ...content,
    };
    this.messageTable.upsert(message);
    this.conversationTable.patch(conversationId, { lastMessageAt: message.createdAt, lastMessagePreview: preview });
    setTimeout(() => this.messageTable.patch(message.id, { status: 'delivered' }), FAKE_DELIVERY_MS);
  }

  private scoped<T extends { tenantId: Id }>(rows: () => T[]) {
    return computed(() => {
      const tenantId = this.session.tenant()?.id ?? null;
      return rows().filter((row) => row.tenantId === tenantId);
    });
  }

  private tenantId(): Id {
    return this.session.tenant()?.id ?? '';
  }

  /** New rows are stamped one minute after the latest one (the demo clock is frozen) so they sort last. */
  private nowIso(): IsoDate {
    const latest = [...this.messages(), ...this.notes()].map((row) => row.createdAt).sort().at(-1);
    const base = Math.max(this.clock.now().getTime(), latest ? new Date(latest).getTime() : 0);
    return new Date(base + 60_000).toISOString();
  }
}
