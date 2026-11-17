import { TestBed } from '@angular/core/testing';
import { provideApiConfig } from '../../core/api/api-config';
import type { ApiPlatformTeam } from '../../shared/api/contract';
import { Confirm } from '../../shared/ui/confirm';
import { PlatformTeamPage } from './platform-team.page';
import { PlatformTeamRemote } from './platform-team.remote';

const TEAM: ApiPlatformTeam = {
  admins: [
    { userId: 'u-me', name: 'Luis', email: 'luis@example.com', createdAt: '2026-10-29T10:00:00Z', hasCode: true, isYou: true },
    { userId: 'u-ana', name: 'Ana', email: 'ana@example.com', createdAt: '2026-11-17T10:00:00Z', hasCode: false, isYou: false },
  ],
  invitations: [{ id: 'inv-1', name: 'Pedro', email: 'pedro@example.com', expiresAt: '2026-11-20T10:00:00Z' }],
  events: [{ action: 'admin.invited', actorName: 'Luis', subjectEmail: 'pedro@example.com', createdAt: '2026-11-17T10:00:00Z' }],
};

async function setup() {
  const remote = {
    overview: vi.fn(() => Promise.resolve(TEAM)),
    invite: vi.fn(() => Promise.resolve('https://x/platform-invitation/abc')),
    resetCode: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
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
  const buttonIn = (row: HTMLElement, text: string) => [...row.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  return { fixture, host, remote, rowOf, buttonIn };
}

describe('PlatformTeamPage', () => {
  it('lists admins and invitations, with whether each set up their code', async () => {
    const { rowOf } = await setup();
    expect(rowOf('Luis (tú)').textContent).toContain('Activado');
    expect(rowOf('Ana').textContent).toContain('Lo configura al entrar');
    expect(rowOf('Pedro').textContent).toContain('Invitación enviada');
  });

  it('offers nothing on my own row: nobody removes themselves or resets their own code', async () => {
    const { rowOf, buttonIn } = await setup();
    expect(rowOf('Luis (tú)').querySelectorAll('button')).toHaveLength(0);
    expect(buttonIn(rowOf('Ana'), 'Quitar acceso')).toBeDefined();
  });

  it('resets another admin\'s code after asking', async () => {
    const { fixture, remote, rowOf, buttonIn } = await setup();
    buttonIn(rowOf('Ana'), 'Reiniciar código')!.click();
    await fixture.whenStable();
    expect(remote.resetCode).toHaveBeenCalledWith('u-ana');
  });

  it('shows the team history in words', async () => {
    const { host } = await setup();
    expect(host.querySelector('.history')?.textContent).toContain('Luis invitó a pedro@example.com');
  });
});
