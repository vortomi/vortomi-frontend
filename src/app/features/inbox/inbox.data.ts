import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { Conversation, Id, IsoDate, Message, MessageTemplate, Note } from '../../shared/api/models';
import { allLoaded, newId } from '../../shared/api/mock-db';
import { editableTable } from '../../shared/api/editable-table';
import { Toaster } from '../../shared/ui/toaster';
import { ContactsData } from '../contacts/contacts.data';
import { InboxRemote } from './inbox-remote';
import { type InboxItem, visibleTo } from './inbox.filters';

export type TimelineEntry =
  | { kind: 'message'; at: IsoDate; message: Message }
  | { kind: 'note'; at: IsoDate; note: Note };

/** Simulated delivery receipt so a sent message visibly moves from ✓ to ✓✓. */
const FAKE_DELIVERY_MS = 1200;
/** Until realtime notices arrive (doc. 09, B7), the inbox asks the server again this often. */
const REFRESH_MS = 15_000;

/**
 * Inbox store. Screens read it the same way in both data modes:
 * - 'mock': the JSON tables, with in-memory edits until the page reloads.
 * - 'api':  the tables are filled from vortomi-backend (InboxRemote) and every action
 *           goes to the server, which decides visibility, the 24 h window and sending.
 */
@Injectable({ providedIn: 'root' })
export class InboxData {
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly contacts = inject(ContactsData);
  private readonly toaster = inject(Toaster);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(InboxRemote) : null;

  private readonly conversationTable = editableTable<Conversation>('conversations');
  private readonly messageTable = editableTable<Message>('messages');
  private readonly noteTable = editableTable<Note>('notes');
  /** 'api' mode: the conversation whose messages are kept fresh. */
  private openId: Id | null = null;

  // Scoped to the active company (tenant_id), as the backend does.
  private readonly conversations = this.scoped(() => this.conversationTable.rows());
  private readonly messages = this.scoped(() => this.messageTable.rows());
  private readonly notes = this.scoped(() => this.noteTable.rows());

  readonly ready = computed(
    () =>
      this.session.ready() &&
      this.contacts.ready() &&
      allLoaded(this.conversationTable, this.messageTable, this.noteTable),
  );

  constructor() {
    if (!this.remote) return;
    // Load the active company's inbox, and keep it fresh while it stays active.
    effect((onCleanup) => {
      const tenantId = this.session.tenant()?.id;
      if (!tenantId) return;
      untracked(() => void this.refresh(tenantId));
      const timer = setInterval(() => void this.refresh(tenantId), REFRESH_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

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

  /** The person opened a conversation: load it ('api' mode) and mark it read. */
  open(conversationId: Id): void {
    if (this.remote) {
      this.openId = conversationId;
      void this.run(async (remote, tenantId) => {
        await this.loadTimeline(tenantId, conversationId);
        if (this.findItem(conversationId)?.conversation.unreadCount) {
          this.conversationTable.patch(conversationId, { unreadCount: 0 });
          await remote.markRead(tenantId, conversationId);
        }
      });
      return;
    }
    this.markRead(conversationId);
  }

  sendText(conversationId: Id, body: string): void {
    if (this.remote) return void this.run((remote, tenantId) => remote.sendText(tenantId, conversationId, body), conversationId);
    this.appendOutbound(conversationId, { type: 'text', body, templateId: null }, body);
  }

  sendTemplate(conversationId: Id, template: MessageTemplate): void {
    const firstName = this.findItem(conversationId)?.contact.name.split(' ')[0] ?? '';
    if (this.remote) {
      const count = new Set(template.body.match(/\{\{\s*\d+\s*\}\}/g) ?? []).size;
      // The chat cannot ask for each value yet: only templates with no data or just the name.
      if (count > 1) return this.toaster.show('Esta plantilla pide varios datos. Pronto podrás escribirlos desde el chat.', 'info');
      const parameters = count === 1 ? [firstName || 'cliente'] : [];
      return void this.run((remote, tenantId) => remote.sendTemplate(tenantId, conversationId, template.id, parameters), conversationId);
    }
    const body = template.body.replace('{{1}}', firstName).replace(/\{\{\d+\}\}/g, '…');
    this.appendOutbound(conversationId, { type: 'template', body, templateId: template.id }, `Plantilla: ${body}`);
  }

  /** Product card from the inventory. Free-form message: needs the 24 h window open. */
  sendProduct(conversationId: Id, body: string, productVariantId: Id): void {
    if (this.remote) return void this.run((remote, tenantId) => remote.sendText(tenantId, conversationId, body), conversationId);
    const title = body.split('\n')[0] ?? body;
    this.appendOutbound(conversationId, { type: 'product', body, templateId: null, productVariantId }, `Producto: ${title}`);
  }

  addNote(conversationId: Id, body: string): void {
    const author = this.session.user();
    if (!author) return;
    const mentionUserId = this.findItem(conversationId)?.conversation.assignedUserId ?? null;
    if (this.remote) {
      return void this.run((remote, tenantId) => remote.addNote(tenantId, conversationId, body, mentionUserId), conversationId);
    }
    this.noteTable.upsert({
      id: newId('note'),
      tenantId: this.tenantId(),
      conversationId,
      authorUserId: author.id,
      mentionUserId,
      body,
      createdAt: this.nowIso(),
    });
  }

  assign(conversationId: Id, userId: Id | null): void {
    if (this.remote) return void this.run((remote, tenantId) => remote.assign(tenantId, conversationId, userId), conversationId);
    this.conversationTable.patch(conversationId, { assignedUserId: userId });
  }

  toggleResolved(conversationId: Id): void {
    const status = this.findItem(conversationId)?.conversation.status === 'resolved' ? 'open' : 'resolved';
    if (this.remote) return void this.run((remote, tenantId) => remote.setStatus(tenantId, conversationId, status), conversationId);
    this.conversationTable.patch(conversationId, { status });
  }

  markRead(conversationId: Id): void {
    if (this.findItem(conversationId)?.conversation.unreadCount) {
      this.conversationTable.patch(conversationId, { unreadCount: 0 });
    }
  }

  /**
   * 'api' mode: runs a server action, shows its Spanish error if it fails, and reloads
   * what it changed (the list, and the conversation when one is given).
   */
  private async run(action: (remote: InboxRemote, tenantId: Id) => Promise<unknown>, conversationId?: Id): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    try {
      await action(this.remote, tenantId);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    }
    await this.refresh(tenantId, conversationId);
  }

  private async refresh(tenantId: Id, conversationId: Id | null = this.openId): Promise<void> {
    if (!this.remote) return;
    try {
      const { conversations, contacts } = await this.remote.conversations(tenantId);
      this.contacts.mergeRemote(contacts);
      this.conversationTable.replaceAll(conversations);
      if (this.messageTable.status() !== 'local') this.messageTable.replaceAll([]);
      if (this.noteTable.status() !== 'local') this.noteTable.replaceAll([]);
      if (conversationId) await this.loadTimeline(tenantId, conversationId);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    }
  }

  private async loadTimeline(tenantId: Id, conversationId: Id): Promise<void> {
    if (!this.remote) return;
    const { messages, notes } = await this.remote.timeline(tenantId, conversationId);
    this.messageTable.replaceAll([...this.messageTable.rows().filter((m) => m.conversationId !== conversationId), ...messages]);
    this.noteTable.replaceAll([...this.noteTable.rows().filter((n) => n.conversationId !== conversationId), ...notes]);
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
