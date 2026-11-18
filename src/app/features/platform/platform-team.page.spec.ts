import { TestBed } from '@angular/core/testing';
import { provideApiConfig } from '../../core/api/api-config';
import type { ApiPlatformTeam } from '../../shared/api/contract';
import { Confirm } from '../../shared/ui/confirm';
import { PlatformTeamPage } from './platform-team.page';
import { PlatformTeamRemote } from './platform-team.remote';

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

const TEAM: ApiPlatformTeam = {
  admins: [
    { userId: 'u-me', name: 'Luis', email: 'luis@example.com', createdAt: '2026-10-29T10:00:00Z', hasCode: true, isYou: true, invitedBy: null, lastSignInAt: minutesAgo(1), codeSince: '2026-10-29T10:00:00Z', codeLastUsedAt: minutesAgo(1), sessionCount: 1, lastActionAt: null },
    { userId: 'u-ana', name: 'Ana', email: 'ana@example.com', createdAt: '2026-11-17T10:00:00Z', hasCode: false, isYou: false, invitedBy: 'Luis', lastSignInAt: null, codeSince: null, codeLastUsedAt: null, sessionCount: 1, lastActionAt: null },
  ],
  invitations: [{ id: 'inv-1', name: 'Pedro', email: 'pedro@example.com', expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), createdAt: '2026-11-17T10:00:00Z', invitedBy: 'Luis' }],
  sessions: [
    { id: 's-me', userId: 'u-me', name: 'Luis', browser: 'Chrome', system: 'Windows', mobile: false, ip: '190.75.x.x', createdAt: minutesAgo(60), lastActiveAt: minutesAgo(0), current: true },
    { id: 's-ana', userId: 'u-ana', name: 'Ana', browser: 'Safari', system: 'iPhone', mobile: true, ip: '186.92.x.x', createdAt: minutesAgo(600), lastActiveAt: minutesAgo(300), current: false },
  ],
  events: [{ action: 'admin.invited', actorName: 'Luis', subjectEmail: 'pedro@example.com', subjectName: null, createdAt: '2026-11-17T10:00:00Z' }],
  activity: [
    { action: 'tenant.suspended', actorUserId: 'u-me', actorName: 'Luis', tenantId: 't-1', tenantName: 'Taller Ortiz', createdAt: minutesAgo(5) },
    { action: 'channel.connected', actorUserId: 'u-ana', actorName: 'Ana', tenantId: 't-2', tenantName: 'Óptica Visión', createdAt: minutesAgo(9) },
  ],
};

async function setup() {
  const remote = {
    overview: vi.fn(() => Promise.resolve(TEAM)),
    invite: vi.fn(() => Promise.resolve('https://x/platform-invitation/abc')),
    resetCode: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
    endSessions: vi.fn(() => Promise.resolve({ ended: 1 })),
    endSession: vi.fn(() => Promise.resolve()),
  };
  // Says yes and runs the action, as the dialog does when the person confirms.
  const confirm = { ask: vi.fn(async (request: { action?: () => Promise<unknown> }) => (await request.action?.(), true)) };
  TestBed.configureTestingModule({
    providers: [
      provideApiConfig({ mode: 'api', baseUrl: '/api', supabase: null }),
      { provide: PlatformTeamRemote, useValue: remote },
      { provide: Confirm, useValue: confirm },
    ],
  });
  const fixture = TestBed.createComponent(PlatformTeamPage);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const rowOf = (text: string) => [...host.querySelectorAll('tbody tr')].find((tr) => tr.textContent?.includes(text)) as HTMLElement;
  const button = (root: Element, text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  const section = (title: string) => [...host.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent?.includes(title)) as HTMLElement;
  return { fixture, host, remote, rowOf, button, section };
}

describe('PlatformTeamPage («Staff»)', () => {
  it('each person with their code, last access and who invited them; invitations apart, with their expiry', async () => {
    const { host, rowOf, section } = await setup();
    expect(host.querySelector('h1')?.textContent).toBe('Staff');
    expect(rowOf('Luis').textContent).toContain('Activado');
    expect(rowOf('Ana').textContent).toContain('Lo configura al entrar');
    expect(rowOf('Ana').textContent).toContain('invitado por Luis');
    expect(section('Invitaciones pendientes').textContent).toContain('Vence en 3 días');
    expect(host.querySelector('.strip')?.textContent).toContain('Ana todavía no activó su código de seguridad');
  });

  it('nothing on my own row; another person\'s ⋯ resets their code or signs them out everywhere', async () => {
    const { fixture, remote, rowOf, button } = await setup();
    expect(rowOf('Luis').querySelector('.dots')).toBeNull();
    (rowOf('Ana').querySelector('.dots') as HTMLButtonElement).click();
    await fixture.whenStable();
    button(rowOf('Ana'), 'Cerrar sus sesiones')!.click();
    await fixture.whenStable();
    expect(remote.endSessions).toHaveBeenCalledWith('u-ana');
    (rowOf('Ana').querySelector('.dots') as HTMLButtonElement).click();
    await fixture.whenStable();
    button(rowOf('Ana'), 'Reiniciar código')!.click();
    await fixture.whenStable();
    expect(remote.resetCode).toHaveBeenCalledWith('u-ana');
  });

  it('open sessions: this one cannot be closed from here; another one can', async () => {
    const { fixture, remote, section, button } = await setup();
    const sessions = section('Sesiones abiertas');
    expect(sessions.textContent).toContain('esta sesión');
    expect(sessions.textContent).toContain('IP 186.92.x.x');
    expect(sessions.querySelectorAll('button')).toHaveLength(1);
    button(sessions, 'Cerrar')!.click();
    await fixture.whenStable();
    expect(remote.endSession).toHaveBeenCalledWith('u-ana', 's-ana');
  });

  it('the console\'s activity in words, filtered by kind', async () => {
    const { fixture, section, button } = await setup();
    const activity = section('Actividad en la consola');
    expect(activity.textContent).toContain('Luis suspendió Taller Ortiz');
    button(activity, 'Números')!.click();
    await fixture.whenStable();
    expect(activity.textContent).not.toContain('Taller Ortiz');
    expect(activity.textContent).toContain('Ana conectó un número de Óptica Visión');
  });

  it('the staff\'s history in words', async () => {
    const { section } = await setup();
    expect(section('Historial del staff').textContent).toContain('Luis invitó a pedro@example.com');
  });
});
