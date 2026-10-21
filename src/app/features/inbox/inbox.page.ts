import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { Session } from '../../core/session';
import { Icon } from '../../shared/ui/icon';
import { ChatPanel } from './components/chat-panel';
import { ContactPanel } from './components/contact-panel';
import { ConversationList } from './components/conversation-list';
import { InboxData } from './inbox.data';
import { applyFilters, countByView } from './inbox.filters';
import { InboxViewState } from './inbox.state';

/** Shared inbox (mockup web-1): list, conversation and customer card. */
@Component({
  selector: 'app-inbox-page',
  imports: [Icon, ConversationList, ChatPanel, ContactPanel],
  templateUrl: './inbox.page.html',
  styleUrl: './inbox.page.scss',
  host: { '[class.has-selection]': '!!selected()' },
})
export class InboxPage {
  protected readonly data = inject(InboxData);
  private readonly session = inject(Session);

  /** From the route: /inbox/:conversationId */
  readonly conversationId = input<string>();

  protected readonly filters = inject(InboxViewState).filters;

  private readonly userId = computed(() => this.session.user()?.id ?? null);
  protected readonly list = computed(() => applyFilters(this.data.items(), this.filters(), this.userId()));
  protected readonly counts = computed(() => countByView(this.data.items(), this.userId()));
  protected readonly selected = computed(() => this.data.findItem(this.conversationId()));

  constructor() {
    // Opening a conversation loads it (server mode) and marks it as read, once the inbox is loaded.
    effect(() => {
      const id = this.conversationId();
      if (id && this.data.ready()) untracked(() => this.data.open(id));
    });
  }

  protected onSearch(event: Event): void {
    const search = (event.target as HTMLInputElement).value;
    this.filters.update((f) => ({ ...f, search }));
  }
}
