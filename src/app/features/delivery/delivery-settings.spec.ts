import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideApiConfig } from '../../core/api/api-config';
import { Session } from '../../core/session';
import type { DeliverySettings } from '../../shared/api/models';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { DeliverySettingsPage } from './delivery-settings';
import { DeliveryRemote } from './delivery-remote';

const NEVER_SAVED: DeliverySettings = { configured: false, enabled: false, mode: 'flat', flatPriceCents: 0, charge: 'per_order', zones: [] };

async function setup(saved: DeliverySettings) {
  TestBed.configureTestingModule({
    providers: [
      provideApiConfig({ mode: 'api', baseUrl: '/api', supabase: null }),
      { provide: DeliveryRemote, useValue: { get: () => Promise.resolve(saved), save: () => Promise.resolve(saved) } },
      { provide: Session, useValue: { tenant: signal({ id: 'ten_1' }) } },
    ],
  });
  const fixture = TestBed.createComponent(DeliverySettingsPage);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  return { fixture, host, button, unsaved: TestBed.inject(UnsavedChanges) };
}

describe('DeliverySettingsPage', () => {
  it('a company that never saved its delivery can save it, but leaving untouched does not warn', async () => {
    const { button, unsaved } = await setup(NEVER_SAVED);
    expect(button('Guardar')?.disabled).toBe(false);
    expect(button('Descartar')).toBeUndefined();
    expect(unsaved.any()).toBe(false);
  });

  it('a real change warns before leaving and can be discarded', async () => {
    const { fixture, button, unsaved } = await setup({ ...NEVER_SAVED, configured: true });
    expect(button('Guardar')?.disabled).toBe(true);
    (fixture.componentInstance as unknown as { setMode(mode: string): void }).setMode('zones');
    await fixture.whenStable();
    expect(unsaved.any()).toBe(true);
    expect(button('Descartar')).toBeDefined();
  });
});
