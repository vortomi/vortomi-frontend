import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { ApiConversation, ApiList, ApiMessagePage, ApiNote, ApiSendResult, Page } from '../../shared/api/contract';
import { toContactStub, toConversation, toMessage, toNote } from '../../shared/api/mappers';
import type { Contact, Conversation, Id, Message, Note } from '../../shared/api/models';

/** How many rows the inbox asks for at once (the server pages; older ones come later). */
const CONVERSATIONS_PAGE = 100;
const MESSAGES_PAGE = 100;

/**
 * The inbox against vortomi-backend ('api' mode). Reads return panel models; every
 * failure is an ApiFailure with its Spanish message. Visibility is the server's call.
 */
@Injectable({ providedIn: 'root' })
export class InboxRemote {
  private readonly api = inject(ApiClient);

  async conversations(tenantId: Id): Promise<{ conversations: Conversation[]; contacts: Contact[] }> {
    const page = await this.api.get<Page<ApiConversation>>(this.api.company(tenantId, 'conversations'), { view: 'all', limit: CONVERSATIONS_PAGE });
    return {
      conversations: page.items.map((row) => toConversation(tenantId, row)),
      contacts: page.items.map((row) => toContactStub(tenantId, row)),
    };
  }

  async timeline(tenantId: Id, conversationId: Id): Promise<{ messages: Message[]; notes: Note[] }> {
    const base = this.api.company(tenantId, `conversations/${encodeURIComponent(conversationId)}`);
    const [messages, notes] = await Promise.all([
      this.api.get<ApiMessagePage>(`${base}/messages`, { limit: MESSAGES_PAGE }),
      this.api.get<ApiList<ApiNote>>(`${base}/notes`),
    ]);
    return {
      // The server pages newest first; the chat reads oldest first.
      messages: messages.items.map((row) => toMessage(tenantId, conversationId, row)).reverse(),
      notes: notes.items.map((row) => toNote(tenantId, conversationId, row)),
    };
  }

  /** clientMessageId makes a retried click harmless: the server never sends it twice. */
  sendText(tenantId: Id, conversationId: Id, body: string): Promise<ApiSendResult> {
    return this.api.post<ApiSendResult>(this.conversation(tenantId, conversationId, 'messages'), { body, clientMessageId: crypto.randomUUID() });
  }

  sendTemplate(tenantId: Id, conversationId: Id, templateId: Id, parameters: string[]): Promise<ApiSendResult> {
    return this.api.post<ApiSendResult>(this.conversation(tenantId, conversationId, 'template-messages'), {
      templateId,
      parameters,
      clientMessageId: crypto.randomUUID(),
    });
  }

  addNote(tenantId: Id, conversationId: Id, body: string, mentionUserId: Id | null): Promise<unknown> {
    return this.api.post(this.conversation(tenantId, conversationId, 'notes'), { body, mentionUserId });
  }

  assign(tenantId: Id, conversationId: Id, userId: Id | null): Promise<unknown> {
    return this.api.put(this.conversation(tenantId, conversationId, 'assignee'), { userId });
  }

  setStatus(tenantId: Id, conversationId: Id, status: Conversation['status']): Promise<unknown> {
    return this.api.put(this.conversation(tenantId, conversationId, 'status'), { status });
  }

  markRead(tenantId: Id, conversationId: Id): Promise<unknown> {
    return this.api.post(this.conversation(tenantId, conversationId, 'read'));
  }

  private conversation(tenantId: Id, conversationId: Id, action: string): string {
    return this.api.company(tenantId, `conversations/${encodeURIComponent(conversationId)}/${action}`);
  }
}
