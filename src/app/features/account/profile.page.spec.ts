import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideApiConfig } from '../../core/api/api-config';
import { Auth } from '../../core/auth';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import type { ApiMyProfile } from '../../shared/api/contract';
import { Confirm } from '../../shared/ui/confirm';
import { AccountRemote } from './account.remote';
import { ProfilePage } from './profile.page';
import { myActivityLook, roleBadge, sessionsLine } from './profile.rules';

const now = Date.now();
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

const STAFF: ApiMyProfile = {
  name: 'Yornel Marval',
  email: 'yornel@example.com',
  staff: true,
  memberSince: '2026-10-29T12:00:00Z',
  invitedBy: null,
  lastSignInAt: iso(2),
  code: { since: '2026-10-29T12:00:00Z', lastUsedAt: iso(2) },
  companies: [],
  sessions: [
    { id: 's-here', browser: 'Chrome', system: 'macOS', mobile: false, ip: '190.75.x.x', createdAt: iso(5), lastActiveAt: iso(0), current: true },
    { id: 's-old', browser: 'Edge', system: 'Windows', mobile: false, ip: '200.44.x.x', createdAt: iso(60 * 24 * 9), lastActiveAt: iso(60 * 24 * 9), current: false },
  ],
  activity: [{ action: 'tenant.suspended', target: 'Taller Ortiz', createdAt: iso(15) }],
};

async function setup(profile: ApiMyProfile) {
  const remote = {
    profile: vi.fn(() => Promise.resolve(profile)),
    rename: vi.fn((name: string) => Promise.resolve({ name })),
    endSession: vi.fn(() => Promise.resolve()),
    endOtherSessions: vi.fn(() => Promise.resolve({ ended: 1 })),
  };
  const confirm = { ask: vi.fn(async (request: { action?: () => Promise<unknown> }) => (await request.action?.(), true)) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideApiConfig({ mode: 'api', baseUrl: '/api', supabase: null }),
      { provide: AccountRemote, useValue: remote },
      { provide: Confirm, useValue: confirm },
      // The signed-in person, as the session and the sample tables give them.
      { provide: Session, useValue: { user: signal({ id: 'u-me', name: profile.name, email: profile.email }), isSuperAdmin: signal(profile.staff), tenant: signal({ id: 't-1' }), switchTenant: () => true } },
      { provide: Auth, useValue: { signOut: vi.fn() } },
      { provide: Directory, useValue: { updateUser: vi.fn(), memberships: signal([]), tenantById: signal(new Map()) } },
    ],
  });
  const fixture = TestBed.createComponent(ProfilePage);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const section = (title: string) => [...host.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent?.includes(title)) as HTMLElement;
  const button = (root: Element, text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;
  return { fixture, host, remote, section, button };
}

describe('ProfilePage («Mi perfil»)', () => {
  it('a staff member: who, since when, code and devices; this session cannot be closed from here', async () => {
    const { host, section } = await setup(STAFF);
    expect(host.querySelector('.hero')?.textContent).toContain('Super admin · Staff');
    expect(host.querySelector('.hero')?.textContent).toContain('Primer administrador');
    const sessions = section('Mis sesiones abiertas');
    expect(sessions.textContent).toContain('esta sesión');
    expect(sessions.querySelectorAll('.row button')).toHaveLength(1);
    expect(section('Mi actividad reciente').textContent).toContain('Suspendiste Taller Ortiz');
  });

  it('closes another device, or all the others, through the server', async () => {
    const { fixture, remote, section, button } = await setup(STAFF);
    button(section('Mis sesiones abiertas'), 'Cerrar').click();
    await fixture.whenStable();
    expect(remote.endSession).toHaveBeenCalledWith('s-old');
    button(section('Seguridad'), 'Cerrar las demás').click();
    await fixture.whenStable();
    expect(remote.endOtherSessions).toHaveBeenCalled();
  });

  it('a company person in two companies: their companies instead of the console activity', async () => {
    const { section } = await setup({ ...STAFF, staff: false, code: null, activity: [], companies: [
      { tenantId: 't-1', name: 'Repuestos Andinos', role: 'agent', since: '2026-09-03T12:00:00Z' },
      { tenantId: 't-2', name: 'Mueblería Valle', role: 'admin', since: '2026-09-03T12:00:00Z' },
    ] });
    expect(section('Mis empresas').textContent).toContain('Mueblería Valle');
    expect(section('Mi actividad reciente')).toBeUndefined();
    expect(section('Seguridad').textContent).toContain('Opcional · próximamente');
  });

  it('the name is saved on the server', async () => {
    const { fixture, host, remote } = await setup(STAFF);
    const input = host.querySelector<HTMLInputElement>('#name')!;
    input.value = 'Yornel M.';
    input.dispatchEvent(new Event('input'));
    host.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(remote.rename).toHaveBeenCalledWith('Yornel M.');
  });
});

describe('profile rules', () => {
  it('the badge says the role, the sessions line names the devices', () => {
    expect(roleBadge({ staff: false, companies: [{ tenantId: 't-1', name: 'Repuestos Andinos', role: 'agent', since: '' }] }, 't-1')).toBe('Agente en Repuestos Andinos');
    expect(sessionsLine(STAFF.sessions)).toBe('En Chrome en macOS (esta) y Edge en Windows');
  });

  it('one\'s own activity in second person; joining names nobody', () => {
    expect(myActivityLook({ action: 'admin.code_reset', target: 'Luis', createdAt: '' })).toMatchObject({ text: 'Reiniciaste el código de seguridad de', target: 'Luis' });
    expect(myActivityLook({ action: 'admin.joined', target: 'yo@example.com', createdAt: '' }).target).toBeNull();
  });
});
