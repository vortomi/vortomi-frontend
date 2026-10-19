import type { ApiContact, ApiConversation, ApiMessage, ApiSettings, ApiTeamMember, ApiTemplate } from './contract';
import { contactName, previewOf, toContact, toConversation, toMessage, toSettings, toTeamMember, toTemplate } from './mappers';

const TENANT = 't-1';

describe('server -> panel mappers', () => {
  it('a conversation keeps its counts and reads its last message as a preview', () => {
    const row: ApiConversation = {
      id: 'c-1',
      status: 'open',
      assignedUserId: null,
      lastActivityAt: '2026-10-19T10:00:00.000Z',
      channelAccountId: 'ch-1',
      contact: { id: 'k-1', waId: '584145550187', name: null, displayName: 'José' },
      serviceWindowExpiresAt: '2026-10-20T10:00:00.000Z',
      unreadCount: 2,
      lastMessage: { direction: 'in', type: 'image', body: null, createdAt: '2026-10-19T10:01:00.000Z' },
    };
    expect(toConversation(TENANT, row)).toEqual({
      id: 'c-1',
      tenantId: TENANT,
      channelAccountId: 'ch-1',
      contactId: 'k-1',
      assignedUserId: null,
      status: 'open',
      lastMessageAt: '2026-10-19T10:01:00.000Z',
      lastMessagePreview: 'Foto',
      unreadCount: 2,
      serviceWindowExpiresAt: '2026-10-20T10:00:00.000Z',
    });
  });

  it('previews say what a message was when it has no text', () => {
    expect(previewOf('text', 'Hola')).toBe('Hola');
    expect(previewOf('audio', null)).toBe('Audio');
    expect(previewOf('template', 'Tu pedido salió')).toBe('Plantilla: Tu pedido salió');
  });

  it('a contact is named by the team first, then by WhatsApp, then by its number', () => {
    expect(contactName({ waId: '584145550187', name: 'José G.', displayName: 'Jose' })).toBe('José G.');
    expect(contactName({ waId: '584145550187', name: null, displayName: 'Jose' })).toBe('Jose');
    expect(contactName({ waId: '584145550187', name: null, displayName: null })).toBe('+58 414-555-0187');
    const row: ApiContact = {
      id: 'k-1', channelAccountId: 'ch-1', waId: '584145550187', name: null, displayName: null,
      stageId: 's-1', quoteCents: 4300, lastInboundAt: null, createdAt: '2026-10-01T00:00:00.000Z', tagIds: ['tag-1'],
    };
    expect(toContact(TENANT, row)).toMatchObject({ phone: '+58 414-555-0187', stageId: 's-1', quoteCents: 4300, tagIds: ['tag-1'], attributes: [] });
  });

  it('messages: direction, numeric id and kinds the panel does not draw', () => {
    const base: ApiMessage = {
      id: 42, direction: 'out', author: 'staff', authorUserId: 'u-1', type: 'text', body: 'Hola',
      templateId: null, createdAt: '2026-10-19T10:00:00.000Z', clientMessageId: null, status: 'delivered',
    };
    expect(toMessage(TENANT, 'c-1', base)).toMatchObject({ id: '42', direction: 'outbound', type: 'text', body: 'Hola', status: 'delivered' });
    expect(toMessage(TENANT, 'c-1', { ...base, direction: 'in', type: 'audio', body: null, status: null })).toMatchObject({
      direction: 'inbound',
      type: 'text',
      body: 'Audio',
    });
  });

  it('a template that never reached Meta shows why', () => {
    const row: ApiTemplate = {
      id: 'tpl-1', wabaId: '2001', name: 'promo', language: 'es', category: 'marketing', status: 'draft',
      rejectionReason: null, submitError: 'no_credentials', body: 'Oferta', bodyExample: [],
    };
    expect(toTemplate(TENANT, row)).toMatchObject({ status: 'draft', rejectionReason: 'no_credentials' });
  });

  it('settings and team rows become the shapes the screens use', () => {
    const settings: ApiSettings = { workMode: 'support_only', businessHours: [], awayMessage: '', exchangeRateVes: null };
    expect(toSettings(TENANT, settings)).toMatchObject({ tenantId: TENANT, workMode: 'support_only', logoDataUrl: null });
    const member: ApiTeamMember = { userId: 'u-1', name: 'Carlos', role: 'agent', status: 'active', canSeeOthers: false, channelAccountIds: ['ch-1'] };
    expect(toTeamMember(TENANT, member)).toEqual({
      user: { id: 'u-1', name: 'Carlos', email: '', platformRole: null },
      membership: { tenantId: TENANT, userId: 'u-1', role: 'agent', status: 'active', channelAccountIds: ['ch-1'], canSeeOthers: false },
    });
  });
});
