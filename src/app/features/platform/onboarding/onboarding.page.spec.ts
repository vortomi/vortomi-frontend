import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Confirm } from '../../../shared/ui/confirm';
import { Toaster } from '../../../shared/ui/toaster';
import { PlatformData } from '../platform.data';
import { OnboardingPage } from './onboarding.page';
import { OnboardingState } from './onboarding.state';

/** Only what the page reads from the sign-up state: the steps themselves are not rendered here. */
function fakeState() {
  const tenantId = signal<string | null>(null);
  return {
    tenantId,
    step: signal(0),
    connected: signal(false),
    invitationToken: signal<string | null>(null),
    resuming: signal(false),
    tenant: signal(null),
    company: signal({ name: 'Corteza' }),
    start: vi.fn(() => tenantId.set(null)),
    resume: vi.fn((id: string) => tenantId.set(id)),
  };
}

async function setup(resume?: string, leftOpen: string | null = null) {
  const state = fakeState();
  state.tenantId.set(leftOpen);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: OnboardingState, useValue: state },
      { provide: PlatformData, useValue: {} },
      { provide: Confirm, useValue: {} },
      { provide: Toaster, useValue: {} },
    ],
  });
  TestBed.overrideComponent(OnboardingPage, { set: { imports: [], template: '' } });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(OnboardingPage);
  if (resume) fixture.componentRef.setInput('resume', resume);
  await fixture.whenStable();
  return { fixture, state, navigate };
}

describe('OnboardingPage', () => {
  it('a new sign-up starts empty, and once step 1 is saved the address names the company', async () => {
    const { fixture, state, navigate } = await setup();
    expect(state.start).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    state.tenantId.set('ten_new');
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { resume: 'ten_new' }, replaceUrl: true }));
  });

  it('reloading the page resumes the company in the address instead of starting over', async () => {
    const { state, navigate } = await setup('ten_saved');
    expect(state.resume).toHaveBeenCalledWith('ten_saved');
    expect(state.start).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('«Nueva empresa» after leaving another one half way starts empty, without dragging the old one into the address', async () => {
    const { state, navigate } = await setup(undefined, 'ten_old');
    expect(state.start).toHaveBeenCalled();
    expect(state.tenantId()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('the address catching up with a just-saved company does not reload it', async () => {
    const { fixture, state } = await setup();
    state.tenantId.set('ten_new');
    await fixture.whenStable();
    fixture.componentRef.setInput('resume', 'ten_new');
    await fixture.whenStable();
    expect(state.resume).not.toHaveBeenCalled();
  });
});
