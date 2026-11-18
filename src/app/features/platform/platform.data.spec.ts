import { TestBed } from '@angular/core/testing';
import { provideApiConfig } from '../../core/api/api-config';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import type { ApiPlatformTenant, ApiPlatformTenantDetail } from '../../shared/api/contract';
import { PlatformData } from './platform.data';
import { PlatformRemote } from './platform-remote';

const TENANT = { id: 't-1', name: 'Vortomi Demo', status: 'active', plan: 'internal', memberCount: 2 } as ApiPlatformTenant;
const LISTED = { ...TENANT, channels: [{ id: 'ch-1', label: 'Demo', displayNumber: '+1 555-660-1436', status: 'connected' }] } as unknown as ApiPlatformTenant;
const DETAIL = {
  ...TENANT,
  channels: [{ id: 'ch-1', label: 'Demo', displayNumber: '+1 555-660-1436', status: 'connected', phoneNumberId: '1098', wabaId: '1523', hasToken: true }],
  members: [],
  invitations: [],
} as unknown as ApiPlatformTenantDetail;

describe('PlatformData (api mode)', () => {
  it('the open company\'s numbers carry their Meta ids, which the list does not bring', async () => {
    const remote = { tenants: vi.fn(() => Promise.resolve([LISTED])), usage: vi.fn(() => Promise.resolve([])), tenant: vi.fn(() => Promise.resolve(DETAIL)) };
    TestBed.configureTestingModule({
      providers: [
        provideApiConfig({ mode: 'api', baseUrl: '/api', supabase: null }),
        { provide: PlatformRemote, useValue: remote },
        // In 'api' mode the console reads neither the session nor the sample tables; they only have to exist.
        { provide: Session, useValue: {} },
        { provide: Directory, useValue: {} },
      ],
    });
    const data = TestBed.inject(PlatformData);
    await data.load();
    expect(data.row('t-1')!.channels[0]!.wabaId).toBe('');
    await data.loadDetail('t-1');
    expect(data.row('t-1')!.channels[0]).toMatchObject({ wabaId: '1523', phoneNumberId: '1098' });
  });
});
