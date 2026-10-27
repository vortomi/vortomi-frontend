// Server shapes (contract.ts) -> the models the screens already use (models.ts).
// The only place that knows both: screens never see the server's field names.
// Fields the server does not provide yet get explicit neutral values, marked "not on the server yet".
import { formatWaId } from '../format/phone';
import type {
  ApiCategory,
  ApiChannel,
  ApiCompany,
  ApiContact,
  ApiCustomField,
  ApiConversation,
  ApiMessage,
  ApiMessageType,
  ApiMovement,
  ApiNote,
  ApiProduct,
  ApiQuickReply,
  ApiSettings,
  ApiStage,
  ApiTag,
  ApiTeamMember,
  ApiTemplate,
  ApiUsageRow,
  ApiVariant,
  ApiVariantType,
} from './contract';
import type {
  ChannelAccount,
  Contact,
  CustomField,
  Conversation,
  Id,
  Membership,
  Message,
  MessageTemplate,
  Note,
  PipelineStage,
  Product,
  ProductCategory,
  ProductVariant,
  QuickReply,
  StockMovement,
  Tag,
  Tenant,
  TenantSettings,
  UsageMonth,
  User,
  VariantOption,
  VariantType,
} from './models';

/** How each kind of message reads in a one-line preview. */
const PREVIEW_LABEL: Record<ApiMessageType, string> = {
  text: 'Mensaje',
  image: 'Foto',
  audio: 'Audio',
  video: 'Video',
  document: 'Documento',
  sticker: 'Sticker',
  location: 'Ubicación',
  contacts: 'Contacto compartido',
  interactive: 'Respuesta',
  button: 'Respuesta',
  reaction: 'Reacción',
  template: 'Plantilla',
  unsupported: 'Mensaje que WhatsApp no deja mostrar aquí',
};

/** One line for the conversation list: the text, or what kind of message it was. */
export function previewOf(type: ApiMessageType, body: string | null): string {
  if (type === 'template') return `Plantilla: ${body ?? ''}`.trim();
  return body?.trim() ? body : PREVIEW_LABEL[type];
}

/** Name to show: the one the team gave, else WhatsApp's profile name, else the number. */
export function contactName(contact: { waId: string; name: string | null; displayName: string | null }): string {
  return contact.name ?? contact.displayName ?? formatWaId(contact.waId);
}

export function toConversation(tenantId: Id, row: ApiConversation): Conversation {
  return {
    id: row.id,
    tenantId,
    channelAccountId: row.channelAccountId,
    contactId: row.contact.id,
    assignedUserId: row.assignedUserId,
    status: row.status,
    lastMessageAt: row.lastMessage?.createdAt ?? row.lastActivityAt,
    lastMessagePreview: row.lastMessage ? previewOf(row.lastMessage.type, row.lastMessage.body) : '',
    unreadCount: row.unreadCount,
    serviceWindowExpiresAt: row.serviceWindowExpiresAt,
  };
}

export function toContact(tenantId: Id, row: ApiContact): Contact {
  return {
    id: row.id,
    tenantId,
    channelAccountId: row.channelAccountId,
    waId: row.waId,
    name: contactName(row),
    phone: formatWaId(row.waId),
    stageId: row.stageId,
    tagIds: row.tagIds,
    quoteCents: row.quoteCents,
    createdAt: row.createdAt,
    ownerUserId: row.ownerUserId,
    attributes: row.attributes,
    customValues: row.customValues,
    // Purchases come with orders (documentations/09, B9).
    purchasesCount: 0,
    purchasesTotalCents: 0,
  };
}

/** The panel shows text, images, templates and product cards; other kinds read as text. */
export function toMessage(tenantId: Id, conversationId: Id, row: ApiMessage): Message {
  const shown = row.type === 'image' || row.type === 'template' ? row.type : 'text';
  return {
    id: String(row.id),
    tenantId,
    conversationId,
    direction: row.direction === 'in' ? 'inbound' : 'outbound',
    type: shown,
    body: shown === 'text' && row.type !== 'text' ? previewOf(row.type, row.body) : (row.body ?? ''),
    authorUserId: row.authorUserId,
    templateId: row.templateId,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function toNote(tenantId: Id, conversationId: Id, row: ApiNote): Note {
  return { id: row.id, tenantId, conversationId, authorUserId: row.authorUserId, mentionUserId: row.mentionUserId, body: row.body, createdAt: row.createdAt };
}

export const toTag = (tenantId: Id, row: ApiTag): Tag => ({ id: row.id, tenantId, name: row.name, tone: row.tone });

export const toQuickReply = (tenantId: Id, row: ApiQuickReply): QuickReply => ({ id: row.id, tenantId, shortcut: row.shortcut, title: row.title, body: row.body });

export const toStage = (tenantId: Id, row: ApiStage): PipelineStage => ({ id: row.id, tenantId, name: row.name, color: row.color, position: row.position });

export function toTemplate(tenantId: Id, row: ApiTemplate): MessageTemplate {
  return {
    id: row.id,
    tenantId,
    name: row.name,
    category: row.category,
    language: row.language,
    status: row.status,
    // A submission that never reached Meta explains itself the same way a rejection does.
    rejectionReason: row.rejectionReason ?? row.submitError,
    body: row.body,
  };
}

export function toSettings(tenantId: Id, row: ApiSettings): TenantSettings {
  return {
    id: `settings_${tenantId}`,
    tenantId,
    workMode: row.workMode,
    businessHours: row.businessHours,
    awayMessage: row.awayMessage,
    // Not on the server yet (needs file storage).
    logoDataUrl: null,
  };
}

/** A team row becomes the User and Membership pair the screens work with. */
export function toTeamMember(tenantId: Id, row: ApiTeamMember): { user: User; membership: Membership } {
  return {
    user: { id: row.userId, name: row.name, email: row.email ?? '', platformRole: null },
    membership: {
      tenantId,
      userId: row.userId,
      role: row.role,
      status: row.status,
      channelAccountIds: row.channelAccountIds,
      canSeeOthers: row.canSeeOthers,
    },
  };
}

export function toProduct(tenantId: Id, row: ApiProduct): { product: Product; variants: ProductVariant[] } {
  return {
    product: {
      id: row.id,
      tenantId,
      name: row.name,
      categoryId: row.categoryId,
      variantTypeIds: row.variantTypeIds,
      category: row.category,
      description: row.description,
      stockMode: row.stockMode,
      saleUnit: row.saleUnit,
      minQuantity: row.minQuantity,
      quantityStep: row.quantityStep,
      customValues: row.customValues,
      active: row.active,
      // Not on the server yet (needs file storage).
      photoDataUrl: null,
      createdAt: row.createdAt,
    },
    variants: row.variants.map((variant) => toVariant(tenantId, variant)),
  };
}

/** A type with its values, as the panel keeps them: two lists. */
export function toVariantType(tenantId: Id, row: ApiVariantType): { type: VariantType; options: VariantOption[] } {
  return {
    type: { id: row.id, tenantId, name: row.name },
    options: row.options.map((o) => ({ id: o.id, tenantId, typeId: row.id, value: o.value })),
  };
}

export const toCategory = (tenantId: Id, row: ApiCategory): ProductCategory => ({ id: row.id, tenantId, name: row.name });

export function toVariant(tenantId: Id, row: ApiVariant): ProductVariant {
  return {
    id: row.id,
    tenantId,
    productId: row.productId,
    optionIds: row.optionIds,
    name: row.name,
    sku: row.sku,
    priceCents: row.priceCents,
    onHand: row.onHand,
    reserved: row.reserved,
    available: row.available,
    lowStockThreshold: row.lowStockThreshold,
  };
}

export function toMovement(tenantId: Id, variantId: Id, row: ApiMovement): StockMovement {
  return { id: String(row.id), tenantId, variantId, kind: row.kind, quantity: row.quantity, reason: row.reason, userId: row.userId, createdAt: row.createdAt };
}

export function toUsage(row: ApiUsageRow): UsageMonth {
  return {
    tenantId: row.tenantId,
    channelAccountId: row.channelAccountId,
    month: row.month,
    totalMessages: row.totalMessages,
    serviceMessages: row.serviceMessages,
    utilityMessages: row.utilityMessages,
    marketingMessages: row.marketingMessages,
    freeEntryMessages: row.freeEntryMessages,
  };
}

/** A company from /me. Fiscal and profile data are not in that response: neutral values. */
export function toTenant(row: ApiCompany): Tenant {
  return {
    id: row.tenantId,
    name: row.name,
    slug: row.slug,
    status: row.tenantStatus,
    plan: row.plan,
    timezone: row.timezone,
    currency: 'USD',
    // Not in /me (only the console needs them).
    industry: '',
    city: '',
    legalName: '',
    taxId: '',
    fiscalAddress: '',
    createdAt: '',
  };
}

/** Colours told apart in the panel, given by position until each company can choose its own. */
const CHANNEL_COLORS = ['#3b4fd8', '#e8743b', '#10a37f', '#7c3aed', '#d9467a'];

export function toChannel(tenantId: Id, row: ApiChannel, index: number): ChannelAccount {
  return {
    id: row.id,
    tenantId,
    label: row.label,
    displayNumber: row.displayNumber,
    phoneNumberId: row.phoneNumberId,
    wabaId: row.wabaId,
    status: row.status,
    color: CHANNEL_COLORS[index % CHANNEL_COLORS.length]!,
    // Number health is not on the server yet (doc. 09, B13): neutral values.
    qualityRating: 'high',
    messagingTier: 250,
    coexistence: false,
    accessExpiresAt: null,
  };
}

/**
 * The contact embedded in a conversation, when the contacts list has not brought it
 * (it pages): enough for the inbox card until the full row arrives.
 */
export function toContactStub(tenantId: Id, row: ApiConversation): Contact {
  return {
    id: row.contact.id,
    tenantId,
    channelAccountId: row.channelAccountId,
    waId: row.contact.waId,
    name: contactName(row.contact),
    phone: formatWaId(row.contact.waId),
    stageId: null,
    tagIds: [],
    ownerUserId: null,
    purchasesCount: 0,
    purchasesTotalCents: 0,
    attributes: [],
    customValues: {},
    createdAt: '',
  };
}

export const toCustomField = (tenantId: Id, row: ApiCustomField): CustomField => ({ ...row, tenantId });
