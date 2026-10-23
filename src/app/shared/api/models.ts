// Shapes of the data the backend will return. Field names mirror the tables in
// documentations/03-alta-de-empresas.md and 04-arquitectura.md, so the JSON files in
// public/data double as a draft of the database.

export type Id = string;
/** ISO 8601 timestamp with offset. */
export type IsoDate = string;

/** Colour families shared by tags, statuses and badges. */
export type Tone = 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'neutral' | 'pink' | 'teal';

export type TenantStatus = 'draft' | 'awaiting_channel' | 'active' | 'suspended' | 'cancelled';
export type TenantPlan = 'internal' | 'basic' | 'team';

export interface Tenant {
  id: Id;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  industry: string;
  city: string;
  timezone: string;
  currency: 'USD';
  /** Fiscal data for our invoices; it must match what the company shows Meta in its business verification. */
  legalName: string;
  /** Venezuelan RIF, normalised: "J-41234567-8". */
  taxId: string;
  fiscalAddress: string;
  createdAt: IsoDate;
}

/** Business category Meta shows on the WhatsApp profile (WhatsAppVertical enum of the Graph API). */
export type WhatsAppVertical =
  | 'OTHER' | 'AUTO' | 'BEAUTY' | 'APPAREL' | 'EDU' | 'ENTERTAIN' | 'EVENT_PLAN' | 'FINANCE' | 'GROCERY' | 'GOVT'
  | 'HOTEL' | 'HEALTH' | 'NONPROFIT' | 'PROF_SERVICES' | 'RETAIL' | 'TRAVEL' | 'RESTAURANT' | 'ALCOHOL';

/** Meta's review of the display name of a number (name_status of the phone number). */
export type DisplayNameStatus = 'approved' | 'pending_review' | 'declined';

export interface User {
  id: Id;
  name: string;
  email: string;
  platformRole: 'super_admin' | null;
}

export type TenantRole = 'admin' | 'agent';

export interface Membership {
  tenantId: Id;
  userId: Id;
  role: TenantRole;
  status: 'active' | 'invited';
  /** Business numbers this person attends. */
  channelAccountIds: Id[];
  /** Whether the person sees conversations assigned to someone else. */
  canSeeOthers: boolean;
}

export type ChannelStatus = 'connected' | 'disconnected' | 'restricted';
export type QualityRating = 'high' | 'medium' | 'low';

export interface ChannelAccount {
  id: Id;
  tenantId: Id;
  label: string;
  displayNumber: string;
  phoneNumberId: string;
  wabaId: string;
  status: ChannelStatus;
  qualityRating: QualityRating;
  /** New customers per day Meta allows this number to contact. */
  messagingTier: number;
  coexistence: boolean;
  /** Colour the tenant picked to tell its numbers apart. */
  color: string;
  /** When our access to the tenant's Meta assets expires; the token itself never reaches the panel. */
  accessExpiresAt: IsoDate | null;
}

export interface Contact {
  id: Id;
  tenantId: Id;
  channelAccountId: Id;
  waId: string;
  name: string;
  phone: string;
  stageId: Id | null;
  tagIds: Id[];
  ownerUserId: Id | null;
  purchasesCount: number;
  purchasesTotalCents: number;
  /** Free fields each tenant defines (vehicle, address...). */
  attributes: ContactAttribute[];
  /** Value of the open opportunity shown in the pipeline (v1: one opportunity per contact). */
  quoteCents?: number | null;
  createdAt: IsoDate;
}

export interface ContactAttribute {
  /** Stable machine key, always in English: "vehicle". */
  key: string;
  /** Label the tenant chose, shown as is: "Vehículo". */
  label: string;
  value: string;
}

export interface Conversation {
  id: Id;
  tenantId: Id;
  channelAccountId: Id;
  contactId: Id;
  assignedUserId: Id | null;
  status: 'open' | 'resolved';
  lastMessageAt: IsoDate;
  lastMessagePreview: string;
  unreadCount: number;
  /** End of the 24 h service window; null when the customer never wrote. */
  serviceWindowExpiresAt: IsoDate | null;
}

export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'image' | 'template' | 'product';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: Id;
  tenantId: Id;
  conversationId: Id;
  direction: MessageDirection;
  type: MessageType;
  body: string;
  /** Agent who wrote it; null for customer messages. */
  authorUserId: Id | null;
  templateId: Id | null;
  /** Product card sent from the inventory. */
  productVariantId?: Id | null;
  /** Derived from message_events on the backend; null for inbound messages. */
  status: MessageStatus | null;
  createdAt: IsoDate;
}

export interface Note {
  id: Id;
  tenantId: Id;
  conversationId: Id;
  authorUserId: Id;
  mentionUserId: Id | null;
  body: string;
  createdAt: IsoDate;
}

export interface Tag {
  id: Id;
  tenantId: Id;
  name: string;
  tone: Tone;
}

export interface PipelineStage {
  id: Id;
  tenantId: Id;
  name: string;
  color: string;
  position: number;
}

export interface QuickReply {
  id: Id;
  tenantId: Id;
  shortcut: string;
  title: string;
  body: string;
}

export type TemplateCategory = 'utility' | 'marketing' | 'authentication';
/** Meta's review. draft: stored but not accepted by Meta yet (or its submission failed). */
export type TemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';

export interface MessageTemplate {
  id: Id;
  tenantId: Id;
  name: string;
  category: TemplateCategory;
  language: string;
  status: TemplateStatus;
  rejectionReason: string | null;
  body: string;
}

/** Opening hours of one weekday (0 = Sunday). null times mean closed. */
export interface DayHours {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  open: string | null;
  close: string | null;
}

/**
 * How the company works. Without configuration it does both; "support_only" hides the pipeline
 * and the inventory. There is no "sales only": selling over WhatsApp already means answering chats.
 */
export type WorkMode = 'sales_and_support' | 'support_only';

export interface TenantSettings {
  id: Id;
  tenantId: Id;
  /** Missing means the default, sales and support. */
  workMode?: WorkMode;
  /** Prototype keeps the image inline; production stores it in Storage and keeps the path. */
  logoDataUrl: string | null;
  businessHours: DayHours[];
  /** Sent automatically when someone writes outside business hours. Empty = disabled. */
  awayMessage: string;
  /** Bolívares per dollar the company uses today; null hides Bs prices. */
  exchangeRateVes?: number | null;
}

/** "units": counted stock (resale). "availability": made to order, only an "available today" switch. */
export type StockMode = 'units' | 'availability';

/** One entry of the company's category list; products pick from it. */
export interface ProductCategory {
  id: Id;
  tenantId: Id;
  name: string;
}

export interface Product {
  id: Id;
  tenantId: Id;
  name: string;
  /** Null: no category yet. */
  categoryId: Id | null;
  /** Name of that category, filled in by the store from the list (empty without one). */
  category: string;
  description: string;
  /** Prototype keeps the image inline; production stores it in Storage. */
  photoDataUrl: string | null;
  stockMode: StockMode;
  active: boolean;
  createdAt: IsoDate;
}

export interface ProductVariant {
  id: Id;
  tenantId: Id;
  productId: Id;
  /** Option that tells variants apart: brand, model, size... */
  name: string;
  sku: string;
  priceCents: number;
  /** Units in stock (units mode). Only movements change it. */
  onHand: number;
  /** Units set aside for quotes not paid yet. */
  reserved: number;
  /** Availability mode switch. */
  available: boolean;
  lowStockThreshold: number;
}

export type StockMovementKind = 'initial' | 'purchase' | 'sale' | 'adjustment' | 'loss' | 'return';

/** Immutable stock history: on_hand is the sum of these (documentations/05-inventario.md). */
export interface StockMovement {
  id: Id;
  tenantId: Id;
  variantId: Id;
  kind: StockMovementKind;
  /** Positive adds, negative removes. */
  quantity: number;
  reason: string;
  userId: Id;
  createdAt: IsoDate;
}

/**
 * Meta consumption of ONE business number in the current billing month: Meta grants the free
 * service messages per number, so the count cannot live at company level (shared/billing/meta-pricing.ts).
 */
export interface UsageMonth {
  tenantId: Id;
  channelAccountId: Id;
  month: string;
  /** Every message in and out, for the platform dashboard. */
  totalMessages: number;
  /** Free-form replies inside the 24 h window. */
  serviceMessages: number;
  utilityMessages: number;
  marketingMessages: number;
  /** Any category sent inside a 72 h free entry point window (ads that click to WhatsApp). */
  freeEntryMessages: number;
}

/**
 * Attention figures of one person (or nobody: userId null = never answered) on one calendar day.
 * Prototype stand-in for what the backend's reports endpoint will compute from the messages.
 */
export interface ReportDay {
  tenantId: Id;
  /** Calendar day in the company's time zone, "2026-10-09". */
  date: string;
  userId: Id | null;
  conversations: number;
  /** Conversations whose first reply took 15 minutes or less. */
  onTime: number;
  /** Median seconds to the first reply that day; null when nothing was answered. */
  firstResponseMedianSec: number | null;
  /** Contacts this person moved to the company's last pipeline stage that day, and their quotes. */
  wonCount: number;
  wonCents: number;
}

export interface Invitation {
  id: Id;
  tenantId: Id;
  email: string;
  name: string;
  role: TenantRole;
  invitedByUserId: Id;
  /**
   * Prototype only: the link token in clear so the demo can open it.
   * The real table stores just token_hash (documentations/03-alta-de-empresas.md, rule 3).
   */
  demoToken: string;
  expiresAt: IsoDate;
  acceptedAt: IsoDate | null;
  createdAt: IsoDate;
}

export type AuditAction =
  | 'tenant.created'
  | 'tenant.activated'
  | 'tenant.suspended'
  | 'tenant.reactivated'
  | 'channel.connected'
  | 'invitation.sent'
  | 'invitation.accepted';

export interface AuditEntry {
  id: Id;
  tenantId: Id;
  actorUserId: Id;
  action: AuditAction;
  detail: string;
  createdAt: IsoDate;
}
