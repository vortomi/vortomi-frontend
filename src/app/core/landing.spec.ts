import { resolveLanding, safeReturnUrl } from './landing';

describe('resolveLanding', () => {
  it('sends a person with one company straight to its inbox', () => {
    expect(resolveLanding({ isSuperAdmin: false, enterableTenantIds: ['ten_a'], returnUrl: null })).toEqual({
      path: '/inbox',
      selectTenantId: 'ten_a',
    });
  });

  it('honours the page the person was trying to open', () => {
    expect(resolveLanding({ isSuperAdmin: false, enterableTenantIds: ['ten_a'], returnUrl: '/contacts' }).path).toBe(
      '/contacts',
    );
  });

  it('asks to choose when there are several companies or none', () => {
    expect(resolveLanding({ isSuperAdmin: false, enterableTenantIds: ['a', 'b'], returnUrl: null }).path).toBe(
      '/select-company',
    );
    expect(resolveLanding({ isSuperAdmin: false, enterableTenantIds: [], returnUrl: null }).path).toBe('/select-company');
  });

  it('never sends a company user to the platform console', () => {
    expect(resolveLanding({ isSuperAdmin: false, enterableTenantIds: ['a'], returnUrl: '/platform/tenants' }).path).toBe(
      '/inbox',
    );
  });

  it('lets our team go back to the console page they asked for', () => {
    expect(resolveLanding({ isSuperAdmin: true, enterableTenantIds: ['a'], returnUrl: '/platform/alerts' }).path).toBe(
      '/platform/alerts',
    );
  });
});

describe('safeReturnUrl', () => {
  it('keeps internal paths', () => {
    expect(safeReturnUrl('/inbox/cnv_1')).toBe('/inbox/cnv_1');
  });

  it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', 'inbox', '/login', '/invitation/x'])(
    'rejects %s',
    (value) => {
      expect(safeReturnUrl(value)).toBeNull();
    },
  );
});
