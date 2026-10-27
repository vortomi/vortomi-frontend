// Shapes vortomi-backend answers with (its README, "API"). Kept apart from models.ts on
// purpose: the screens use models.ts, and mappers.ts translates between the two, so a
// change on the server touches this file and the mappers, never the screens.
// Dates arrive as ISO strings; ids are UUIDs except message and movement ids (numbers).

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiMe {
  user: { id: string; email: string; name: string; platformRole: 'super_admin' | null };
  secondFactor: boolean;
  companies: ApiCompany[];
}

export interface ApiCompany {
  tenantId: string;
  name: string;
  slug: string;
  tenantStatus: 'draft' | 'awaiting_channel' | 'active' | 'suspended' | 'cancelled';
  plan: 'internal' | 'basic' | 'team';
  timezone: string;
  role: 'admin' | 'agent';
}

export interface ApiChannel {
  id: string;
  label: string;
  displayNumber: string;
  phoneNumberId: string;
  wabaId: string;
  status: 'connected' | 'disconnected' | 'restricted';
}

export interface ApiMember {
  tenantId: string;
  userId: string;
  role: 'admin' | 'agent';
  canSeeOthers: boolean;
  channelAccountIds: string[];
}

export interface ApiTeamMember {
  userId: string;
  name: string;
  /** Only for admins. */
  email?: string;
  role: 'admin' | 'agent';
  status: 'invited' | 'active' | 'disabled';
  canSeeOthers: boolean;
  channelAccountIds: string[];
}

export type ApiMessageType =
  | 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location'
  | 'contacts' | 'interactive' | 'button' | 'reaction' | 'template' | 'unsupported';

export interface ApiConversation {
  id: string;
  status: 'open' | 'resolved';
  assignedUserId: string | null;
  lastActivityAt: string;
  channelAccountId: string;
  contact: { id: string; waId: string; name: string | null; displayName: string | null };
  serviceWindowExpiresAt: string | null;
  unreadCount: number;
  lastMessage: { direction: 'in' | 'out'; type: ApiMessageType; body: string | null; createdAt: string } | null;
}

export interface ApiMessage {
  id: number;
  direction: 'in' | 'out';
  author: 'customer' | 'staff' | 'bot' | 'owner_app';
  authorUserId: string | null;
  type: ApiMessageType;
  body: string | null;
  templateId: string | null;
  createdAt: string;
  clientMessageId: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | null;
}

export interface ApiMessagePage {
  items: ApiMessage[];
  nextBeforeId: number | null;
}

export interface ApiNote {
  id: string;
  authorUserId: string;
  mentionUserId: string | null;
  body: string;
  createdAt: string;
}

export interface ApiSendResult {
  messageId: number;
  outcome: 'sent' | 'failed' | 'already_sent';
}

export interface ApiContact {
  id: string;
  channelAccountId: string;
  waId: string;
  name: string | null;
  displayName: string | null;
  stageId: string | null;
  quoteCents: number | null;
  ownerUserId: string | null;
  attributes: { key: string; label: string; value: string }[];
  lastInboundAt: string | null;
  createdAt: string;
  tagIds: string[];
}

export interface ApiTag {
  id: string;
  name: string;
  tone: 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'neutral' | 'pink' | 'teal';
}

export interface ApiQuickReply {
  id: string;
  shortcut: string;
  title: string;
  body: string;
}

export interface ApiStage {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface ApiSettings {
  workMode: 'sales_and_support' | 'support_only';
  businessHours: { day: 0 | 1 | 2 | 3 | 4 | 5 | 6; open: string | null; close: string | null }[];
  awayMessage: string;
}

export interface ApiExchangeRates {
  rateSource: 'bcv' | 'custom';
  bcv: { bsPerUsd: string | null; effectiveDate: string | null; checkedAt: string | null; error: string | null };
  exchangeRates: {
    bsPerUsd: string;
    previousBsPerUsd: string | null;
    effectiveDate: string;
    changedBy: string | null;
    createdAt: string;
    source: 'bcv' | 'manual';
  }[];
}

export interface ApiTemplate {
  id: string;
  wabaId: string;
  name: string;
  language: string;
  category: 'utility' | 'marketing' | 'authentication';
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';
  rejectionReason: string | null;
  submitError: string | null;
  body: string;
  bodyExample: string[];
}

export interface ApiVariant {
  id: string;
  productId: string;
  optionId: string | null;
  name: string;
  sku: string;
  priceCents: number;
  onHand: number;
  reserved: number;
  availableUnits: number;
  available: boolean;
  lowStockThreshold: number;
}

export interface ApiCategory {
  id: string;
  name: string;
  productCount: number;
}

export interface ApiVariantType {
  id: string;
  name: string;
  options: { id: string; value: string; variantCount: number }[];
}

export interface ApiProduct {
  id: string;
  name: string;
  categoryId: string | null;
  variantTypeId: string | null;
  category: string;
  description: string;
  stockMode: 'availability' | 'units';
  active: boolean;
  createdAt: string;
  variants: ApiVariant[];
}

export interface ApiMovement {
  id: number;
  kind: 'initial' | 'purchase' | 'sale' | 'adjustment' | 'loss' | 'return';
  quantity: number;
  reason: string;
  userId: string;
  createdAt: string;
}

export interface ApiUsageRow {
  tenantId: string;
  channelAccountId: string;
  month: string;
  totalMessages: number;
  serviceMessages: number;
  utilityMessages: number;
  marketingMessages: number;
  authenticationMessages: number;
  freeEntryMessages: number;
}

export interface ApiList<T> {
  items: T[];
}

/** An open invitation as the team screen lists it. The token only comes on create and renew. */
export interface ApiInvitation {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  canSeeOthers: boolean;
  channelAccountIds: string[];
  expiresAt: string;
  createdAt: string;
  token?: string;
}

/** What the invitation page shows before the person signs in (/public/invitations/:token). */
export interface ApiInvitationPreview {
  companyName: string;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  expiresAt: string;
  hasAccount: boolean;
}

/** A company as the platform console lists it (/platform/tenants). */
export interface ApiPlatformTenant {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'awaiting_channel' | 'active' | 'suspended' | 'cancelled';
  plan: 'internal' | 'basic' | 'team';
  industry: string;
  city: string;
  timezone: string;
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  createdAt: string;
  channels: { id: string; label: string; displayNumber: string; status: 'connected' | 'disconnected' | 'restricted' }[];
  memberCount: number;
}

/** One company in detail: numbers (never their token), people and open invitations. */
export interface ApiPlatformTenantDetail extends Omit<ApiPlatformTenant, 'channels' | 'memberCount'> {
  channels: (ApiChannel & { hasToken: boolean })[];
  members: { userId: string; name: string; email: string; role: 'admin' | 'agent'; status: 'invited' | 'active' | 'disabled' }[];
  invitations: ApiInvitation[];
}

export interface ApiWabaLookup {
  wabaTakenBy: string | null;
  numbers: { phoneNumberId: string; displayNumber: string; verifiedName: string; nameStatus: string; takenBy: string | null; alreadyHere: boolean }[];
}
