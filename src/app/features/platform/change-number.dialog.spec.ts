import { TestBed } from '@angular/core/testing';
import type { ApiWabaLookup } from '../../shared/api/contract';
import type { ChannelAccount } from '../../shared/api/models';
import { ChangeNumberDialog } from './change-number.dialog';
import { PlatformData } from './platform.data';

const CHANNEL = { id: 'ch-1', tenantId: 't-1', label: 'Demo', displayNumber: '+1 555-660-1436', phoneNumberId: '1098', wabaId: '1523' } as ChannelAccount;
const LOOKUP: ApiWabaLookup = {
  wabaTakenBy: null,
  businessVerified: null,
  numbers: [{ phoneNumberId: '1098', displayNumber: '+1 555-660-1436', verifiedName: 'Test Number', nameStatus: 'APPROVED', takenBy: null, alreadyHere: true }],
};

async function setup() {
  // The native <dialog> is not opened by every test DOM; the content is there either way.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
  const data = {
    lookupForChannel: vi.fn(() => Promise.resolve(LOOKUP)),
    replaceNumber: vi.fn(() => Promise.resolve(null)),
  };
  TestBed.configureTestingModule({ providers: [{ provide: PlatformData, useValue: data }] });
  const fixture = TestBed.createComponent(ChangeNumberDialog);
  fixture.componentRef.setInput('tenantId', 't-1');
  fixture.componentRef.setInput('channel', CHANNEL);
  fixture.componentRef.setInput('open', true);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  const type = async (selector: string, text: string) => {
    const input = host.querySelector<HTMLInputElement>(selector)!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const search = async () => {
    host.querySelector<HTMLFormElement>('form.search')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  const current = () => host.querySelector<HTMLButtonElement>('button.number')!;
  const save = () => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => /Guardar la clave nueva|Cambiar número/.test(b.textContent ?? ''))!;
  return { fixture, host, data, changed, type, search, current, save };
}

describe('ChangeNumberDialog', () => {
  it('without a new token, the current number cannot be picked again', async () => {
    const { search, current } = await setup();
    await search();
    expect(current().disabled).toBe(true);
    expect(current().textContent).toContain('Actual');
  });

  it('with a new token, the same number keeps its place and only the token is saved', async () => {
    const { fixture, host, data, changed, type, search, current, save } = await setup();
    await type('#cn-token', 'EAAnewtoken1234567890');
    await search();
    expect(data.lookupForChannel).toHaveBeenCalledWith('t-1', 'ch-1', '1523', 'EAAnewtoken1234567890');
    expect(current().disabled).toBe(false);
    current().click();
    await fixture.whenStable();
    expect(host.textContent).toContain('El número no cambia');
    expect(save().textContent).toContain('Guardar la clave nueva');
    save().click();
    await fixture.whenStable();
    expect(data.replaceNumber).toHaveBeenCalledWith('t-1', 'ch-1', { wabaId: '1523', phoneNumberId: '1098', accessToken: 'EAAnewtoken1234567890' });
    expect(changed).toHaveBeenCalledWith('token');
  });

  it('an account field that is not digits (a browser filled it with an email) is never sent', async () => {
    const { host, data, type, search } = await setup();
    await type('#cn-waba', 'someone@example.com');
    await search();
    expect(data.lookupForChannel).not.toHaveBeenCalled();
    expect(host.textContent).toContain('lleva solo números');
  });

  it('the token field asks password managers not to fill it', async () => {
    const { host } = await setup();
    expect(host.querySelector('#cn-token')!.getAttribute('autocomplete')).toBe('new-password');
  });

  it('erasing the token after picking the current number blocks the save', async () => {
    const { fixture, type, search, current, save } = await setup();
    await type('#cn-token', 'EAAnewtoken1234567890');
    await search();
    current().click();
    await fixture.whenStable();
    await type('#cn-token', '');
    expect(save().disabled).toBe(true);
  });
});
