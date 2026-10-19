// Pure contact rules, tested without Angular.
import type { Contact, Id, Membership } from '../../shared/api/models';

export interface ContactFilters {
  search: string;
  channelId: Id | null;
  stageId: Id | null;
  tagId: Id | null;
  ownerId: Id | null;
}

export const EMPTY_CONTACT_FILTERS: ContactFilters = { search: '', channelId: null, stageId: null, tagId: null, ownerId: null };

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Admins see every contact; agents only those who wrote to the numbers they attend. */
export function visibleContacts(contacts: Contact[], membership: Membership | null): Contact[] {
  if (!membership) return [];
  if (membership.role === 'admin') return contacts;
  return contacts.filter((c) => membership.channelAccountIds.includes(c.channelAccountId));
}

export function applyContactFilters(contacts: Contact[], filters: ContactFilters): Contact[] {
  const needle = normalize(filters.search);
  const digits = needle.replace(/\D/g, '');
  return contacts
    .filter((c) => !filters.channelId || c.channelAccountId === filters.channelId)
    .filter((c) => !filters.stageId || c.stageId === filters.stageId)
    .filter((c) => !filters.tagId || c.tagIds.includes(filters.tagId))
    .filter((c) => !filters.ownerId || (filters.ownerId === 'none' ? c.ownerUserId === null : c.ownerUserId === filters.ownerId))
    .filter((c) => !needle || normalize(c.name).includes(needle) || (digits.length >= 3 && c.waId.includes(digits)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * A contact is unique per (company, number, wa_id): the same person writing to two numbers of
 * the company is two contacts, and two companies never share one (original document, rule 2).
 */
export function findDuplicate(contacts: Contact[], channelId: Id, waId: string, exceptId?: Id): Contact | null {
  return contacts.find((c) => c.channelAccountId === channelId && c.waId === waId && c.id !== exceptId) ?? null;
}
