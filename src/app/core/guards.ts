// Route guards. They improve the experience (no flash of a screen you cannot use);
// they are NOT the security boundary: the backend checks every request on its own.
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';
import { CompanyData } from './company-data';
import { Directory } from './directory';
import { resolveLanding } from './landing';
import { Session } from './session';
import { Workspace } from './workspace';

export const signedInGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const session = inject(Session);
  await inject(Directory).loaded;
  return session.user() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Login and password pages: a signed-in person goes to their landing page instead. */
export const guestGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const session = inject(Session);
  await inject(Directory).loaded;
  if (!session.user()) return true;
  const landing = resolveLanding({
    isSuperAdmin: session.isSuperAdmin(),
    enterableTenantIds: session.enterableTenantIds(),
    returnUrl: null,
  });
  if (landing.selectTenantId) session.switchTenant(landing.selectTenantId);
  return router.parseUrl(landing.path);
};

/** The company panel needs an active company the person can enter. */
export const tenantGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const session = inject(Session);
  await inject(Directory).loaded;
  if (session.tenant()) return true;
  const [only] = session.enterableTenantIds();
  if (session.enterableTenantIds().length === 1 && only && !session.isSuperAdmin()) {
    session.switchTenant(only);
    return true;
  }
  return router.parseUrl('/select-company');
};

/** Company settings and team management: company admins only. */
export const tenantAdminGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const session = inject(Session);
  await inject(Directory).loaded;
  return session.isTenantAdmin() ? true : router.parseUrl('/inbox');
};

/** Pipeline and inventory: only for companies that sell (the default). */
export const salesModeGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const workspace = inject(Workspace);
  await Promise.all([inject(Directory).loaded, inject(CompanyData).loaded]);
  return workspace.sells() ? true : router.parseUrl('/inbox');
};

export const superAdminGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const session = inject(Session);
  await inject(Directory).loaded;
  return session.isSuperAdmin() ? true : router.parseUrl('/inbox');
};

/** The second-factor page only makes sense right after a correct password. */
export const mfaPendingGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(Auth).mfaPendingUserId() ? true : router.parseUrl('/login');
};
