import { Component, computed, inject, signal } from '@angular/core';
import { FormField, email, form, maxLength, pattern, readonly, required, submit } from '@angular/forms/signals';
import { FieldError } from '../../../shared/ui/field-error';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';
import { Toaster } from '../../../shared/ui/toaster';
import type { DisplayNameStatus } from '../../../shared/api/models';
import {
  DEMO_NEW_WABA_ID,
  PROFILE_ABOUT_MAX,
  PROFILE_ADDRESS_MAX,
  WEBSITE,
  type WabaLookup,
  type WabaNumber,
} from './onboarding.rules';
import { OnboardingState, type WhatsAppProfile, profileFrom } from './onboarding.state';
import { WhatsAppProfileFields } from './whatsapp-profile';

const NAME_STATUS: Record<DisplayNameStatus, string> = {
  approved: 'aprobado por Meta',
  pending_review: 'en revisión de Meta',
  declined: 'rechazado por Meta',
};

/** Our Meta business id the customer adds as a partner. Prototype value. */
const OUR_BUSINESS_ID = '4815 1623 4200';

interface ConnectModel {
  wabaId: string;
  phoneNumberId: string;
  pin: string;
  label: string;
  profile: WhatsAppProfile;
}

/** Step 2 (mockup web-10). */
@Component({
  selector: 'app-step-channel',
  imports: [FormField, FieldError, Icon, Pill, WhatsAppProfileFields],
  templateUrl: './step-channel.html',
  styleUrl: './steps.scss',
  styles: `
    .idbox { display: inline-flex; align-items: center; gap: 10px; background: #f4f5f8; border: 1px solid #dde1e7;
      border-radius: var(--radius-sm); padding: 5px 6px 5px 12px; font-size: 14px; font-weight: 600; margin-top: 6px; }
    .idbox .btn { height: 28px; padding: 0 10px; font-size: 12px; }
    .search-row { display: flex; gap: 10px; align-items: flex-start; }
    .search-row .field { flex: 1; }
    .search-row .btn { margin-top: 23px; height: 40px; }
    .numbers { display: flex; flex-direction: column; gap: 8px; }
    .num { display: flex; align-items: center; gap: 12px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md);
      padding: 10px 12px; text-align: left; background: var(--color-surface); cursor: pointer; }
    .num.on { border-color: var(--color-primary); background: var(--color-primary-softer); box-shadow: 0 0 0 1px var(--color-primary); }
    .num:disabled { cursor: default; }
    .num.taken { cursor: not-allowed; background: #fdf6f5; border-color: #f3b9b1; }
    .num .rd { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #c3c9d4; flex-shrink: 0; }
    .num.on .rd { border: 5px solid var(--color-primary); }
    .num b { display: block; font-size: 14px; } .num small { font-size: 12px; color: var(--color-text-muted); }
    .num app-pill { margin-left: auto; }
    .found { font-size: 12.5px; color: #166534; font-weight: 600; }
    .sub-title { font-size: 14px; margin: 18px 0 2px; }
  `,
})
export class StepChannel {
  protected readonly state = inject(OnboardingState);
  private readonly toaster = inject(Toaster);

  protected readonly businessId = OUR_BUSINESS_ID;
  protected readonly demoWaba = DEMO_NEW_WABA_ID;
  protected readonly nameStatus = NAME_STATUS;
  protected readonly lookup = signal<WabaLookup | null>(null);
  protected readonly searching = signal(false);
  protected readonly connecting = signal(false);

  private readonly model = signal<ConnectModel>({ wabaId: '', phoneNumberId: '', pin: '', label: 'Ventas', profile: profileFrom(this.state.company()) });
  protected readonly connectForm = form(this.model, (path) => {
    required(path.wabaId, { message: 'Escribe el identificador de la cuenta.' });
    required(path.phoneNumberId, { message: 'Elige el número que va a usar.' });
    required(path.pin, { message: 'El cliente escribe su PIN.' });
    pattern(path.pin, /^\d{6}$/, { message: 'Son 6 números.' });
    maxLength(path.pin, 6);
    required(path.label, { message: 'Ponle un nombre interno.' });
    // Meta's rules for the profile of the number.
    required(path.profile.about, { message: 'Escribe una frase corta sobre el negocio.' });
    maxLength(path.profile.about, PROFILE_ABOUT_MAX, { message: `Máximo ${PROFILE_ABOUT_MAX} caracteres.` });
    required(path.profile.vertical, { message: 'Elige la categoría.' });
    email(path.profile.email, { message: 'Ese correo no parece válido.' });
    pattern(path.profile.website, WEBSITE, { message: 'Empieza con https://' });
    maxLength(path.profile.address, PROFILE_ADDRESS_MAX, { message: `Máximo ${PROFILE_ADDRESS_MAX} caracteres.` });
    // Once connected, the number is stored for this company; changing it means a new connection.
    const locked = () => this.state.connected();
    readonly(path.wabaId, locked);
    readonly(path.pin, locked);
    readonly(path.label, locked);
    readonly(path.profile, locked);
  });

  protected readonly numbers = computed(() => {
    const lookup = this.lookup();
    return lookup?.status === 'found' ? lookup.numbers : [];
  });
  protected readonly allTaken = computed(() => this.numbers().length > 0 && this.numbers().every((n) => n.takenBy));
  protected readonly selected = computed(() => this.numbers().find((n) => n.phoneNumberId === this.model().phoneNumberId));

  protected async search(): Promise<void> {
    if (!this.model().wabaId.trim()) {
      this.connectForm.wabaId().markAsTouched();
      return;
    }
    this.searching.set(true);
    this.lookup.set(null);
    const result = await this.state.lookupWaba(this.model().wabaId);
    this.searching.set(false);
    this.lookup.set(result);
    const free = result.status === 'found' ? result.numbers.find((n) => !n.takenBy) : undefined;
    this.connectForm.phoneNumberId().value.set(free?.phoneNumberId ?? '');
  }

  protected choose(number: WabaNumber): void {
    if (!number.takenBy) this.connectForm.phoneNumberId().value.set(number.phoneNumberId);
  }

  protected copyBusinessId(): void {
    void navigator.clipboard?.writeText(OUR_BUSINESS_ID.replace(/\s/g, '')).catch(() => undefined);
    this.toaster.show('Identificador copiado');
  }

  protected async connect(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.connectForm, async () => {
      const number = this.selected();
      const lookup = this.lookup();
      if (!number || number.takenBy || lookup?.status !== 'found') return undefined;
      this.connecting.set(true);
      const { wabaId, label, profile } = this.model();
      await this.state.connect({ wabaId, number, account: lookup.account, label, profile });
      this.connecting.set(false);
      return undefined;
    });
  }
}
