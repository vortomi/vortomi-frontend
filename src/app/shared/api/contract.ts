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
  companies: { tenantId: string; name: string; tenantStatus: string; role: 'admin' | 'agent' }[];
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
  exchangeRateVes: number | null;
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
  name: string;
  sku: string;
  priceCents: number;
  onHand: number;
  reserved: number;
  availableUnits: number;
  available: boolean;
  lowStockThreshold: number;
}

export interface ApiProduct {
  id: string;
  name: string;
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
