import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, Router, type RouterStateSnapshot, type UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import type { Tenant } from '../shared/api/models';
import { Directory } from './directory';
import { joiningGuard, tenantGuard } from './guards';
import { Session } from './session';

/** What the guards read from the session: companies I can work in, and those waiting for me to connect a number. */
function setup(state: { enterable?: string[]; joining?: string[]; superAdmin?: boolean } = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Directory, useValue: { loaded: Promise.resolve() } },
      {
        provide: Session,
        useValue: {
          tenant: signal<Tenant | null>(null),
          enterableTenantIds: signal(state.enterable ?? []),
          joiningTenants: signal((state.joining ?? []).map((id) => ({ id }) as Tenant)),
          isSuperAdmin: signal(state.superAdmin ?? false),
          switchTenant: () => true,
        },
      },
    ],
  });
  const router = TestBed.inject(Router);
  const url = (result: unknown) => router.serializeUrl(result as UrlTree);
  const run = (guard: typeof tenantGuard, params: Record<string, string> = {}) =>
    TestBed.runInInjectionContext(() => guard({ paramMap: convertToParamMap(params) } as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  return { url, run };
}

describe('a company waiting for its owner', () => {
  it('its owner, with no other company, lands on «Conecta tu WhatsApp» instead of the panel', async () => {
    const { run, url } = setup({ joining: ['ten_new'] });
    expect(url(await run(tenantGuard))).toBe('/connect-whatsapp/ten_new');
  });

  it('someone who also works in an active company chooses where to go', async () => {
    const { run, url } = setup({ enterable: ['ten_a', 'ten_b'], joining: ['ten_new'] });
    expect(url(await run(tenantGuard))).toBe('/select-company');
  });

  it('«Conecta tu WhatsApp» opens only for a company that waits for me', async () => {
    const { run, url } = setup({ joining: ['ten_new'] });
    expect(await run(joiningGuard, { tenantId: 'ten_new' })).toBe(true);
    expect(url(await run(joiningGuard, { tenantId: 'ten_other' }))).toBe('/select-company');
  });
});
