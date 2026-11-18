import type { Router } from '@angular/router';
import { resolveLanding } from '../../core/landing';
import type { Session } from '../../core/session';

/** After a sign-in: the console, the only company, or the company picker (same rule everywhere). */
export async function enterPanel(session: Session, router: Router, returnUrl: string | null): Promise<void> {
  const landing = resolveLanding({ isSuperAdmin: session.isSuperAdmin(), enterableTenantIds: session.enterableTenantIds(), returnUrl });
  if (landing.selectTenantId) session.switchTenant(landing.selectTenantId);
  await router.navigateByUrl(landing.path);
}
