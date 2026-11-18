import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { Session } from '../../core/session';
import { PasswordResetRemote, type ResetLookup } from './password-reset.remote';
import { ResetPasswordPage } from './reset-password.page';

const VALID: ResetLookup = { status: 'valid', preview: { name: 'Carlos Ruiz', givenBy: 'Laura Méndez', companyName: 'Repuestos Andinos', staff: false, expiresAt: '2099-01-01T00:00:00Z' } };

async function setup(lookup: ResetLookup, signIn: 'signed_in' | 'mfa_required' = 'signed_in') {
  const remote = { lookup: vi.fn(() => Promise.resolve(lookup)), complete: vi.fn(() => Promise.resolve({ email: 'carlos@example.com' })) };
  const auth = { signIn: vi.fn(() => Promise.resolve(signIn)) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PasswordResetRemote, useValue: remote },
      { provide: Auth, useValue: auth },
      { provide: Session, useValue: { isSuperAdmin: () => false, enterableTenantIds: () => ['t-1'], switchTenant: () => true } },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const navigateTo = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ResetPasswordPage);
  fixture.componentRef.setInput('token', 'tok');
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const type = (id: string, value: string) => {
    const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  return { fixture, host, remote, auth, navigate, navigateTo, type };
}

describe('ResetPasswordPage (mockup web-30)', () => {
  it('says who gave the link; saving sets the password and goes straight in', async () => {
    const { fixture, host, remote, auth, navigate, type } = await setup(VALID);
    expect(host.textContent).toContain('Laura Méndez te dio este enlace para Repuestos Andinos');
    type('password', 'pan2026dulce');
    type('confirm', 'pan2026dulce');
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(remote.lookup).toHaveBeenCalledWith('tok');
    expect(remote.complete).toHaveBeenCalledWith('tok', 'pan2026dulce');
    expect(auth.signIn).toHaveBeenCalledWith('carlos@example.com', 'pan2026dulce');
    expect(navigate).toHaveBeenCalled();
  });

  it('the staff go on to their code', async () => {
    const { fixture, host, navigateTo, type } = await setup(VALID, 'mfa_required');
    type('password', 'pan2026dulce');
    type('confirm', 'pan2026dulce');
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(navigateTo).toHaveBeenCalledWith(['/login/verify']);
  });

  it('a used or expired link says so and points to who to ask', async () => {
    const { host } = await setup({ status: 'missing' });
    expect(host.textContent).toContain('Este enlace venció o ya se usó');
    expect(host.querySelector('form')).toBeNull();
  });
});
