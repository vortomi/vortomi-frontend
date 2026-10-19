// Pure list logic of the inbox, kept apart from the store so it can be tested without Angular.
// Visibility mirrors the permissions the backend will enforce; here it only drives what is shown.
import type { Contact, Conversation, Id, Membership } from '../../shared/api/models';

export type InboxView = 'mine' | 'unassigned' | 'all';

export interface InboxFilters {
  view: InboxView;
  channelId: Id | null;
  tagId: Id | null;
  search: string;
}

export interface InboxItem {
  conversation: Conversation;
  contact: Contact;
}

export type ViewCounts = Record<InboxView, number>;

export const EMPTY_FILTERS: InboxFilters = { view: 'all', channelId: null, tagId: null, search: '' };

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** What a person may see: admins see everything; agents only their numbers, and others' chats only if allowed. */
export function visibleTo(items: InboxItem[], membership: Membership | null, userId: Id | null): InboxItem[] {
  if (!membership) return [];
  if (membership.role === 'admin') return items;
  return items.filter(({ conversation }) => {
    if (!membership.channelAccountIds.includes(conversation.channelAccountId)) return false;
    if (membership.canSeeOthers) return true;
    return conversation.assignedUserId === null || conversation.assignedUserId === userId;
  });
}

function inView({ conversation }: InboxItem, view: InboxView, userId: Id | null): boolean {
  switch (view) {
    case 'mine':
      return conversation.status === 'open' && conversation.assignedUserId === userId;
    case 'unassigned':
      return conversation.status === 'open' && conversation.assignedUserId === null;
    case 'all':
      return true;
  }
}

function matchesSearch({ conversation, contact }: InboxItem, search: string): boolean {
  const needle = normalize(search);
  if (!needle) return true;
  const digits = needle.replace(/\D/g, '');
  return (
    normalize(contact.name).includes(needle) ||
    normalize(conversation.lastMessagePreview).includes(needle) ||
    (digits.length >= 3 && contact.phone.replace(/\D/g, '').includes(digits))
  );
}

/** Applies the toolbar filters and sorts by most recent activity. */
export function applyFilters(items: InboxItem[], filters: InboxFilters, userId: Id | null): InboxItem[] {
  return items
    .filter((item) => inView(item, filters.view, userId))
    .filter((item) => !filters.channelId || item.conversation.channelAccountId === filters.channelId)
    .filter((item) => !filters.tagId || item.contact.tagIds.includes(filters.tagId))
    .filter((item) => matchesSearch(item, filters.search))
    .sort((a, b) => b.conversation.lastMessageAt.localeCompare(a.conversation.lastMessageAt));
}

export function countByView(items: InboxItem[], userId: Id | null): ViewCounts {
  return {
    mine: items.filter((item) => inView(item, 'mine', userId)).length,
    unassigned: items.filter((item) => inView(item, 'unassigned', userId)).length,
    all: items.length,
  };
}
