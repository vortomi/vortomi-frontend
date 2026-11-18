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
  tenantStatus: 'draft' | 'awaiting_channel' | 'awaiting_owner' | 'active' | 'suspended' | 'cancelled';
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
  /** Why it is not connected (Meta's account_update); null while connected. */
  statusReason?: 'owner_disconnected' | 'number_changed' | 'inactive' | 'access_removed' | 'banned' | 'ban_scheduled' | 'restricted' | 'account_deleted' | null;
  /** Also on the owner's WhatsApp Business app (the company's list has it; the console's does not). */
  coexistence?: boolean;
  /** When the connection with Meta stops working; null: it does not expire. */
  tokenExpiresAt?: string | null;
}

/** What the panel needs to open Meta's «Conectar WhatsApp» window (all public). */
export type ApiSignupLaunch = { available: false } | { available: true; appId: string; configId: string; graphVersion: string };

/** A number connected from the panel. */
export interface ApiSignupResult {
  channelId: string;
  displayNumber: string;
  coexistence: boolean;
  subscribed: boolean;
  tokenExpiresAt: string | null;
  syncRequested: ('smb_app_state_sync' | 'history')[];
  /** The company was waiting for its owner and is live from now on. */
  activated?: boolean;
}

export interface ApiMember {
  tenantId: string;
  userId: string;
  role: 'admin' | 'agent';
  canSeeOthers: boolean;
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
  assigneeIds: string[];
  handoffReason: 'customer_asked' | 'purchase' | 'order_placed' | 'agent_unsure' | 'agent_error' | 'limit_reached' | 'catalog_unavailable' | 'media_received' | null;
  handoffAt: string | null;
  /** The owner is answering from the WhatsApp Business app: the agent is quiet here until then. */
  agentPausedUntil?: string | null;
  agentPausedByUserId?: string | null;
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
  /** Our copy of its file, when it brought one Vortomi keeps (photo, voice note, sticker, document). */
  media?: ApiMessageMedia | null;
}

export interface ApiMessageMedia {
  status: 'pending' | 'stored' | 'too_large' | 'unavailable';
  fileName: string | null;
  sizeBytes: number | null;
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
  customValues: Record<string, string | number | boolean | string[]>;
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
  /** Read-only: what a new product starts with (set by the welcome). */
  defaultSaleUnit?: ApiSaleUnit;
  defaultStockMode?: 'availability' | 'units';
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
  system: { useSystemRate: boolean; bsPerUsd: string | null; rateDate: string | null } | null;
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
  optionIds: string[];
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

export interface ApiCustomField {
  id: string;
  entity: 'product' | 'contact';
  label: string;
  kind: 'text' | 'number' | 'choice' | 'multi_choice' | 'boolean' | 'date';
  required: boolean;
  position: number;
  options: { id: string; value: string }[];
  categoryIds: string[];
}

/** vortomi-backend SALE_UNITS (src/db/schema/enums.ts). */
export type ApiSaleUnit = 'unit' | 'pair' | 'dozen' | 'box' | 'pack' | 'roll' | 'kg' | 'g' | 'm' | 'm2' | 'l' | 'hour' | 'service' | 'session';

export interface ApiProduct {
  id: string;
  name: string;
  categoryId: string | null;
  variantTypeIds: string[];
  category: string;
  description: string;
  stockMode: 'availability' | 'units';
  saleUnit: ApiSaleUnit;
  minQuantity: number;
  quantityStep: number;
  customValues: Record<string, string | number | boolean | string[]>;
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
/** GET /me/profile: «Mi perfil» (mockup web-29), one's own account only. */
export interface ApiMyProfile {
  name: string;
  email: string;
  /** One of our staff (super admin). */
  staff: boolean;
  memberSince: string | null;
  invitedBy: string | null;
  lastSignInAt: string | null;
  code: { since: string; lastUsedAt: string | null } | null;
  companies: { tenantId: string; name: string; role: 'admin' | 'agent'; since: string }[];
  sessions: Omit<ApiStaffSession, 'userId' | 'name'>[];
  /** Staff only: their own last changes in the console. */
  activity: { action: ConsoleAction | PlatformTeamAction; target: string | null; createdAt: string }[];
}

/** GET /platform/team: the console's «Staff» (mockup web-28). IPs come with their last part hidden. */
export interface ApiPlatformTeam {
  admins: {
    userId: string;
    name: string;
    email: string;
    createdAt: string;
    hasCode: boolean;
    isYou: boolean;
    /** Who invited them; null for the first admins, made by hand. */
    invitedBy: string | null;
    lastSignInAt: string | null;
    codeSince: string | null;
    codeLastUsedAt: string | null;
    sessionCount: number;
    /** Their last change in the console («Actividad en la consola»). */
    lastActionAt: string | null;
  }[];
  invitations: { id: string; name: string; email: string; expiresAt: string; createdAt: string; invitedBy: string }[];
  sessions: ApiStaffSession[];
  events: { action: PlatformTeamAction; actorName: string; subjectEmail: string; subjectName: string | null; createdAt: string }[];
  activity: { action: ConsoleAction; actorUserId: string; actorName: string; tenantId: string | null; tenantName: string | null; createdAt: string }[];
}

export interface ApiStaffSession {
  id: string;
  userId: string;
  name: string;
  browser: string;
  system: string;
  mobile: boolean;
  /** «190.205.x.x»: never the whole address. */
  ip: string | null;
  createdAt: string;
  lastActiveAt: string;
  /** The session this page is open in: it cannot be ended from here. */
  current: boolean;
}

export type PlatformTeamAction =
  | 'admin.invited'
  | 'admin.invitation_renewed'
  | 'admin.invitation_revoked'
  | 'admin.joined'
  | 'admin.code_reset'
  | 'admin.removed'
  | 'admin.session_ended'
  | 'admin.sessions_ended'
  | 'admin.password_reset';

/** What the console did to a company (backend CONSOLE_ACTIONS). */
export type ConsoleAction =
  | 'tenant.created'
  | 'tenant.updated'
  | 'tenant.draft_discarded'
  | 'tenant.activated'
  | 'tenant.suspended'
  | 'tenant.cancelled'
  | 'channel.connected'
  | 'channel.replaced'
  | 'channel.refreshed'
  | 'tenant.admin_invited'
  | 'tenant.owner_invited'
  | 'tenant.invitation_renewed'
  | 'tenant.invitation_revoked'
  | 'business_type.created'
  | 'business_type.reclassified'
  | 'tenant.password_reset'
  | 'tenant.owner_changed';

/** GET /public/platform-invitations/:token */
export interface ApiPlatformInvitationPreview {
  email: string;
  name: string;
  expiresAt: string;
  hasAccount: boolean;
}

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
  status: 'draft' | 'awaiting_channel' | 'awaiting_owner' | 'active' | 'suspended' | 'cancelled';
  plan: 'internal' | 'basic' | 'team';
  businessType: string | null;
  businessTypeOther: string;
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
  members: {
    userId: string;
    name: string;
    email: string;
    role: 'admin' | 'agent';
    status: 'invited' | 'active' | 'disabled';
    isOwner: boolean;
    /** The other companies the person is in, by name (only the console sees them). */
    otherCompanies: string[];
  }[];
  invitations: ApiInvitation[];
}

/** GET /platform/alerts (mockup web-25): facts only, the console writes the sentences. */
export type ApiAlertKind =
  | 'webhooks_failed' | 'unroutable_number' | 'bcv_unread' | 'channel_disconnected' | 'access_expired' | 'access_expiring'
  | 'number_silent' | 'agent_cap_reached' | 'agent_cap_near' | 'catalog_unavailable' | 'free_replies_exceeded' | 'onboarding_stalled';

export interface ApiPlatformAlert {
  id: string;
  kind: ApiAlertKind;
  severity: 'critical' | 'warning';
  category: 'platform' | 'connection' | 'agent' | 'usage' | 'onboarding';
  tenantId: string | null;
  tenantName: string | null;
  channelId: string | null;
  channelLabel: string | null;
  since: string | null;
  facts: Record<string, string | number | null>;
}

export interface ApiPlatformAlertReport {
  checkedAt: string;
  checked: { companies: number; numbers: number; connected: number };
  alerts: ApiPlatformAlert[];
}

export interface ApiWabaLookup {
  wabaTakenBy: string | null;
  /** Meta's business verification of the account's owner; null when Meta did not say. */
  businessVerified: boolean | null;
  numbers: { phoneNumberId: string; displayNumber: string; verifiedName: string; nameStatus: string; takenBy: string | null; alreadyHere: boolean }[];
}

/** A password link just given (mockup web-30): the token comes back only here, once. */
export interface ApiIssuedReset {
  token: string;
  expiresAt: string;
  name: string;
}

/** GET /public/password-resets/:token: what the page of the link shows. givenBy null: «Vortomi». */
export interface ApiResetPreview {
  name: string;
  givenBy: string | null;
  companyName: string | null;
  staff: boolean;
  expiresAt: string;
}

/** Why a link cannot be given to someone from the company's panel. */
export type ApiResetBlock = 'self' | 'elsewhere' | 'staff' | 'inactive';

/** GET /tenants/:id/team/access (admins): the owner, last accesses, who can get a link and the team's history. */
export interface ApiTeamAccess {
  youAreOwner: boolean;
  /** False when the server cannot set passwords (no Supabase secret key). */
  available: boolean;
  people: { userId: string; isOwner: boolean; lastSignInAt: string | null; elsewhere: boolean; blocked: ApiResetBlock | null }[];
  history: { kind: 'reset_given' | 'reset_used' | 'invited' | 'joined'; actor: string | null; subject: string; at: string }[];
}
