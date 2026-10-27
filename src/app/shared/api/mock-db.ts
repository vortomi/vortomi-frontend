// Prototype data source: every "table" is a JSON file in public/data.
// When the backend exists, only the *.data.ts stores change their URLs; screens stay untouched.
export type MockTable =
  | 'tenants'
  | 'invitations'
  | 'audit-log'
  | 'users'
  | 'memberships'
  | 'channel-accounts'
  | 'contacts'
  | 'conversations'
  | 'messages'
  | 'notes'
  | 'tags'
  | 'pipeline-stages'
  | 'quick-replies'
  | 'templates'
  | 'products'
  | 'product-categories'
  | 'variant-types'
  | 'variant-options'
  | 'product-variants'
  | 'stock-movements'
  | 'tenant-settings'
  | 'exchange-rates'
  | 'custom-fields'
  | 'usage'
  | 'report-days';

export const mockTableUrl = (table: MockTable): string => `/data/${table}.json`;

/**
 * True once every resource has actually loaded. Do not use hasValue() for this: with a
 * defaultValue it is already true while the request is still in flight.
 */
export const allLoaded = (...resources: { status(): string }[]): boolean =>
  resources.every((r) => r.status() === 'resolved' || r.status() === 'local');

/** Ids for rows created while the prototype is open. */
export const newId = (prefix: string): string => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
