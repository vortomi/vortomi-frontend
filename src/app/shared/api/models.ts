// Shapes of the data the backend will return. Field names mirror the tables in
// documentations/03-alta-de-empresas.md and 04-arquitectura.md, so the JSON files in
// public/data double as a draft of the database.

export type Id = string;
/** ISO 8601 timestamp with offset. */
export type IsoDate = string;

/** Colour families shared by tags, statuses and badges. */
export type Tone = 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'neutral' | 'pink' | 'teal';

/** One of the platform's business types (block C): a closed list our team extends from «Otro». */
export interface BusinessType {
  code: string;
  label: string;
  /** One of the panel's icon names; unknown ones fall back to a generic icon. */
  icon: string;
}

/** What a company sells and how, as it answered the welcome. */
export type Sells = 'products' | 'services' | 'both' | 'none';
export type SellMethod = 'unit' | 'weight' | 'measure' | 'time' | 'mixed';

export type TenantStatus = 'draft' | 'awaiting_channel' | 'active' | 'suspended' | 'cancelled';
export type TenantPlan = 'internal' | 'basic' | 'team';

export interface Tenant {
  id: Id;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  /** Code of one of the platform's business types (BusinessTypes); null until it is set. */
  businessType: string | null;
  /** What the company wrote under «Otro», for our team to classify. */
  businessTypeOther: string;
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
  /** 'disabled': kept for history, cannot enter; an admin can bring them back. */
  status: 'active' | 'invited' | 'disabled';
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
  /** Notes typed freely before the company defined its fields; an admin moves them into one. */
  attributes: ContactAttribute[];
  /** The company's own data about the customer ("Vehículo", "Zona"): field id to value. */
  customValues: CustomValues;
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
  /** Who attends it (admins hand it out); empty = unassigned. */
  assigneeIds: Id[];
  /** The sales agent passed it to a person, and why; null while the agent may answer. */
  handoffReason?: HandoffReason | null;
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
  /** Written by the system itself (the sales agent or the away message), not by a person. */
  automatic?: boolean;
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
  /** What a new product starts with (the welcome sets it from «¿Cómo vendes?»). */
  defaultSaleUnit?: SaleUnit;
  defaultStockMode?: StockMode;
}

/** bcv: read from the Banco Central de Venezuela every hour. custom: typed by an admin. */
export type RateSource = 'bcv' | 'custom';

/** One rate of a company's history (bolívares per dollar, as text: no floating point on the way). */
export interface ExchangeRate {
  bsPerUsd: string;
  previousBsPerUsd: string | null;
  /** «Vigente desde»: "2026-10-27". */
  effectiveDate: string;
  /** Name of the admin who typed it; null for the BCV's. */
  changedBy: string | null;
  createdAt: IsoDate;
  source: 'bcv' | 'manual';
}

/** The platform's last read of the BCV (the same for every company). */
export interface BcvStatus {
  bsPerUsd: string | null;
  effectiveDate: string | null;
  checkedAt: IsoDate | null;
  /** Why the last read failed, in Spanish; null when it worked. */
  error: string | null;
}

/** A company's exchange rate card: where it comes from and its last 20 rates (the first is in use). */
export interface ExchangeRateBook {
  /** The company id: one book per company. */
  id: Id;
  tenantId: Id;
  rateSource: RateSource;
  bcv: BcvStatus;
  exchangeRates: ExchangeRate[];
  /** Only for a company with its own catalog system (La Campiña): its rate and whether it is used. */
  system: SystemRateStatus | null;
}

/** The rate a company's own system prices with. bsPerUsd null: the system cannot be read now. */
export interface SystemRateStatus {
  /** «Usar la tasa de mi sistema»: on, every price in bolívares uses this rate instead of the history. */
  useSystemRate: boolean;
  bsPerUsd: string | null;
  /** When the system dated its rate (ISO). */
  rateDate: IsoDate | null;
}

/** "units": counted stock (resale). "availability": made to order, only an "available today" switch. */
export type StockMode = 'units' | 'availability';

/** One entry of the company's category list; products pick from it. */
export interface ProductCategory {
  id: Id;
  tenantId: Id;
  name: string;
}

/** What tells a product's variants apart (Marca, Talla...), defined once per company. */
export interface VariantType {
  id: Id;
  tenantId: Id;
  name: string;
}

/** One value of a type (Bosch, M...). Variants pick it instead of typing a name. */
export interface VariantOption {
  id: Id;
  tenantId: Id;
  typeId: Id;
  value: string;
}

export interface Product {
  id: Id;
  tenantId: Id;
  name: string;
  /** Null: no category yet. */
  categoryId: Id | null;
  /** Up to three types combined (Talla x Color), in order. None: variants are named freely. */
  variantTypeIds: Id[];
  /** Name of that category, filled in by the store from the list (empty without one). */
  category: string;
  description: string;
  /** Prototype keeps the image inline; production stores it in Storage. */
  photoDataUrl: string | null;
  stockMode: StockMode;
  /** The price is per this unit and quantities count in it. */
  saleUnit: SaleUnit;
  /** The least a customer can order, and the size of each step above it. */
  minQuantity: number;
  quantityStep: number;
  /** The company's own data about the product ("Sirve para", "Marca"): field id to value. */
  customValues: CustomValues;
  active: boolean;
  createdAt: IsoDate;
}

/** Whose data a company field describes. */
export type CustomFieldEntity = 'product' | 'contact';
/** How it is answered: short text, number, one or several options of its list, yes or no, date. */
export type CustomFieldKind = 'text' | 'number' | 'choice' | 'multi_choice' | 'boolean' | 'date';
/** Text, number, option id(s), yes/no or "YYYY-MM-DD". */
export type CustomValue = string | number | boolean | string[];
export type CustomValues = Record<Id, CustomValue>;

/** A piece of data the company keeps about its products or customers, defined once (block B). */
export interface CustomField {
  id: Id;
  tenantId: Id;
  entity: CustomFieldEntity;
  label: string;
  kind: CustomFieldKind;
  required: boolean;
  position: number;
  /** List fields only: the choices, in order. */
  options: { id: Id; value: string }[];
  /** Product fields only: the categories it shows in; none means all. */
  categoryIds: Id[];
}

/** How a product is sold; labels and rules in features/inventory/sale-units.ts. */
export type SaleUnit = 'unit' | 'pair' | 'dozen' | 'box' | 'pack' | 'roll' | 'kg' | 'g' | 'm' | 'm2' | 'l' | 'hour' | 'service' | 'session';

export interface ProductVariant {
  id: Id;
  tenantId: Id;
  productId: Id;
  /** One value of each of the product's types, in order; its name is them ("M / Rojo"). None: named freely. */
  optionIds: Id[];
  /** What tells variants apart: brand, model, size... */
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

/** Why the sales agent passed a conversation to a person (same codes as the server). */
export type HandoffReason = 'customer_asked' | 'purchase' | 'order_placed' | 'agent_unsure' | 'agent_error' | 'limit_reached';
export type AgentTone = 'friendly' | 'formal' | 'brief';
export type AgentSchedule = 'always' | 'after_hours';

/** «Ajustes → Agente». */
export interface AgentSettings {
  enabled: boolean;
  assistantName: string;
  tone: AgentTone;
  schedule: AgentSchedule;
  businessInfo: string;
  /** False when the platform has no model: the agent cannot answer anywhere. */
  modelReady: boolean;
  usage: { replies: number; cap: number };
}

export type DeliveryMode = 'flat' | 'zones';

/** «Ajustes → Delivery»: prices in US cents. */
export interface DeliverySettings {
  /** False until the company saves it once. */
  configured: boolean;
  enabled: boolean;
  mode: DeliveryMode;
  flatPriceCents: number;
  zones: { name: string; priceCents: number }[];
}

export type PaymentMethodType =
  | 'pago_movil'
  | 'transfer_national'
  | 'zelle'
  | 'paypal'
  | 'binance'
  | 'transfer_international'
  | 'cash_usd'
  | 'cash_ves'
  | 'cash_eur'
  | 'arrange';
/** The currency the customer pays a method in: it follows the type. */
export type PaymentCurrency = 'VES' | 'USD' | 'EUR';
export type PaymentFieldKind = 'text' | 'bank' | 'document' | 'phone';
/** Whether the customer must send the payment reference or the receipt. */
export type PaymentProofRule = 'required' | 'optional' | 'none';

/** One datum the customer sees to pay ("Banco: 0134 · Banesco"). */
export interface PaymentField {
  kind: PaymentFieldKind;
  label: string;
  value: string;
  copyable: boolean;
}

/** «Métodos de pago»: how the company gets paid. Hidden, never deleted. */
export interface PaymentMethod {
  id: Id;
  type: PaymentMethodType;
  name: string;
  currency: PaymentCurrency;
  fields: PaymentField[];
  instructions: string;
  referenceRule: PaymentProofRule;
  receiptRule: PaymentProofRule;
  /** Offered to customers. */
  isActive: boolean;
  sortOrder: number;
}

/**
 * Waiting for the customer's payment, receipt to review, confirmed by a person (the customer is
 * told), done (delivered or picked up) or cancelled.
 */
export type OrderStatus = 'awaiting_payment' | 'payment_review' | 'confirmed' | 'done' | 'cancelled';

/** An order taken in a conversation (by the sales agent, for now): prices as they were then, in US cents. */
export interface OrderLine {
  name: string;
  quantity: number;
  saleUnit: SaleUnit;
  unitPriceCents: number;
}

export interface Order {
  id: Id;
  code: string;
  status: OrderStatus;
  conversationId: Id;
  contactName: string | null;
  customerName: string;
  fulfillment: 'pickup' | 'delivery';
  zone: string | null;
  address: string | null;
  paymentMethod: { id: Id; name: string; type: PaymentMethodType; currency: PaymentCurrency } | null;
  notes: string;
  /** The bank reference of the payment, typed by whoever checked it (it goes on the receipt). */
  paymentReference: string | null;
  /** Quantity in the product's sale unit (0.15 kg); the price is per one of it. */
  lines: OrderLine[];
  subtotalCents: number;
  /** Null: delivery whose cost a person confirms. */
  deliveryCents: number | null;
  bsPerUsd: string | null;
  /** Payment receipts the customer sent. */
  receiptCount: number;
  createdAt: IsoDate;
}

/** One order with its payment receipts (each file is fetched on its own) and its sale receipt. */
export interface OrderDetail extends Order {
  receipts: { mediaId: Id; mimeType: string; sizeBytes: number; createdAt: IsoDate }[];
  /** Null until completed (or when the company gives none). Code null: the team uploaded its own. */
  saleReceipt: { code: string | null; createdAt: IsoDate } | null;
}

/** Who makes an order's sale receipt: Vortomi, the team (its own picture), or nobody. */
export type ReceiptMode = 'vortomi' | 'own' | 'off';

/** «Ajustes → Recibo». The business name, RIF and address come from the company itself. */
export interface ReceiptSettings {
  mode: ReceiptMode;
  subtitle: string;
  phone: string;
  prefix: string;
  footer: string;
  showAttendedBy: boolean;
  showPaymentReference: boolean;
  hasLogo: boolean;
  /** "APC-000001": the code the next receipt gets. */
  nextCode: string;
  business: { name: string; legalName: string; taxId: string; address: string };
}
