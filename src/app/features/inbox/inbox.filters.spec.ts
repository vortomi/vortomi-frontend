import type { Contact, Conversation, Membership } from '../../shared/api/models';
import { applyFilters, countByView, EMPTY_FILTERS, type InboxItem, visibleTo } from './inbox.filters';

function item(id: string, overrides: Partial<Conversation> = {}, contact: Partial<Contact> = {}): InboxItem {
  return {
    conversation: {
      id,
      tenantId: 'ten_a',
      channelAccountId: 'ch_sales',
      contactId: `con_${id}`,
      assigneeIds: [],
      status: 'open',
      lastMessageAt: '2026-10-09T10:00:00-04:00',
      lastMessagePreview: 'Hola',
      unreadCount: 0,
      serviceWindowExpiresAt: null,
      ...overrides,
    },
    contact: {
      id: `con_${id}`,
      tenantId: 'ten_a',
      channelAccountId: 'ch_sales',
      waId: '584140000000',
      name: `Cliente ${id}`,
      phone: '+58 414-000-0000',
      stageId: null,
      tagIds: [],
      ownerUserId: null,
      purchasesCount: 0,
      purchasesTotalCents: 0,
      attributes: [],
      customValues: {},
      createdAt: '2026-10-01T10:00:00-04:00',
      ...contact,
    },
  };
}

const membership = (overrides: Partial<Membership> = {}): Membership => ({
  tenantId: 'ten_a',
  userId: 'usr_me',
  role: 'agent',
  status: 'active',
  channelAccountIds: ['ch_sales'],
  canSeeOthers: false,
  ...overrides,
});

describe('visibleTo', () => {
  const items = [
    item('mine', { assigneeIds: ['usr_me'] }),
    item('free'),
    item('shared', { assigneeIds: ['usr_other', 'usr_me'] }),
    item('other', { assigneeIds: ['usr_other'] }),
    item('workshop', { channelAccountId: 'ch_workshop' }),
  ];
  const ids = (list: InboxItem[]) => list.map((i) => i.conversation.id);

  it('shows an agent only the chats assigned to them, alone or with others', () => {
    expect(ids(visibleTo(items, membership(), 'usr_me'))).toEqual(['mine', 'shared']);
    expect(ids(visibleTo(items, membership({ canSeeOthers: true }), 'usr_me'))).toEqual(['mine', 'shared']);
  });

  it('shows everything to an admin', () => {
    expect(visibleTo(items, membership({ role: 'admin' }), 'usr_me')).toHaveLength(5);
  });

  it('shows nothing without a membership in the company', () => {
    expect(visibleTo(items, null, 'usr_me')).toEqual([]);
  });
});

describe('applyFilters', () => {
  const items = [
    item('old', { lastMessageAt: '2026-10-08T09:00:00-04:00', assigneeIds: ['usr_me'] }),
    item('new', { lastMessageAt: '2026-10-09T09:00:00-04:00' }, { name: 'José Gutiérrez', tagIds: ['tag_vip'] }),
    item('done', { status: 'resolved', assigneeIds: ['usr_me'] }),
  ];

  it('sorts by latest activity', () => {
    expect(applyFilters(items, EMPTY_FILTERS, 'usr_me').map((i) => i.conversation.id)).toEqual(['done', 'new', 'old']);
  });

  it('keeps resolved chats out of "mine"', () => {
    const mine = applyFilters(items, { ...EMPTY_FILTERS, view: 'mine' }, 'usr_me');
    expect(mine.map((i) => i.conversation.id)).toEqual(['old']);
  });

  it('searches ignoring accents and case', () => {
    const found = applyFilters(items, { ...EMPTY_FILTERS, search: 'jose gutierrez' }, 'usr_me');
    expect(found.map((i) => i.conversation.id)).toEqual(['new']);
  });

  it('filters by tag', () => {
    expect(applyFilters(items, { ...EMPTY_FILTERS, tagId: 'tag_vip' }, 'usr_me')).toHaveLength(1);
  });

  it('counts each view', () => {
    expect(countByView(items, 'usr_me')).toEqual({ mine: 1, unassigned: 1, all: 3 });
  });
});
