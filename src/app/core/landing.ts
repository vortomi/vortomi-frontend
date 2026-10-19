// Where a person lands after signing in. Pure, so the rules are tested without a browser.
import type { Id } from '../shared/api/models';

export interface LandingInput {
  isSuperAdmin: boolean;
  enterableTenantIds: Id[];
  /** Already sanitised with safeReturnUrl. */
  returnUrl: string | null;
}

export interface Landing {
  path: string;
  /** Company to activate before navigating, when there is no choice to make. */
  selectTenantId: Id | null;
}

export function resolveLanding({ isSuperAdmin, enterableTenantIds, returnUrl }: LandingInput): Landing {
  if (isSuperAdmin) {
    return { path: returnUrl?.startsWith('/platform') ? returnUrl : '/select-company', selectTenantId: null };
  }
  const [onlyTenant] = enterableTenantIds;
  if (enterableTenantIds.length === 1 && onlyTenant) {
    const target = returnUrl && !returnUrl.startsWith('/platform') ? returnUrl : '/inbox';
    return { path: target, selectTenantId: onlyTenant };
  }
  return { path: '/select-company', selectTenantId: null };
}

const AUTH_PAGES = ['/login', '/forgot-password', '/reset-password', '/invitation', '/select-company'];

/**
 * Accepts only paths inside this app. Rejects absolute URLs, protocol-relative ones ("//evil.com")
 * and backslash tricks, which would turn the login page into an open redirect.
 */
export function safeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.includes(':')) return null;
  if (AUTH_PAGES.some((page) => raw === page || raw.startsWith(`${page}/`) || raw.startsWith(`${page}?`))) return null;
  return raw;
}
