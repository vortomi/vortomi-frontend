import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { ReceiptMode, ReceiptSettings } from '../../shared/api/models';
import { Confirm } from '../../shared/ui/confirm';
import { FileDrop } from '../../shared/ui/file-drop';
import { Icon } from '../../shared/ui/icon';
import { type OptionCard, OptionCards } from '../../shared/ui/option-cards';
import { Skeleton } from '../../shared/ui/skeleton';
import { Switch } from '../../shared/ui/switch';
import { Toaster } from '../../shared/ui/toaster';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { ReceiptRemote, type ReceiptSettingsInput, readPicture } from './receipt-remote';

const MODES: (OptionCard & { value: ReceiptMode })[] = [
  { value: 'vortomi', label: 'Lo hace Vortomi', icon: 'sparkles', hint: 'Sale solo al completar el pedido' },
  { value: 'own', label: 'Lo subo yo', icon: 'image', hint: 'Subes la imagen de tu recibo' },
  { value: 'off', label: 'No enviar', icon: 'x', hint: 'Tus clientes no reciben recibo' },
];
const MAX_LOGO_BYTES = 1024 * 1024;

const toDraft = (s: ReceiptSettings): ReceiptSettingsInput => ({
  mode: s.mode,
  subtitle: s.subtitle,
  phone: s.phone,
  prefix: s.prefix,
  footer: s.footer,
  showAttendedBy: s.showAttendedBy,
  showPaymentReference: s.showPaymentReference,
});

/**
 * «Ajustes → Recibo»: the receipt every customer gets when their order is completed. One layout
 * for every company: its name, RIF and address come from its profile; here it picks who makes it
 * and adds a subtitle, a phone, the number prefix, its own footer and a logo. A preview shows the
 * receipt exactly as the customer will get it. Admins only; server only.
 */
@Component({
  selector: 'app-receipt-settings',
  imports: [FileDrop, Icon, OptionCards, Skeleton, Switch],
  templateUrl: './receipt-settings.html',
  styleUrls: ['../../shared/ui/section.scss', './receipt-settings.scss'],
})
export class ReceiptSettingsPage {
  protected readonly remote = inject(API_CONFIG).mode === 'api' ? inject(ReceiptRemote) : null;
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(Confirm);

  protected readonly modes = MODES;
  protected readonly saved = signal<ReceiptSettings | null>(null);
  protected readonly draft = signal<ReceiptSettingsInput | null>(null);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly preview = signal<string | null>(null);
  /** The settings could not be read: said once, with a retry, instead of loading forever. */
  protected readonly loadError = signal<string | null>(null);
  protected readonly dirty = computed(() => {
    const saved = this.saved();
    const draft = this.draft();
    return !!saved && !!draft && JSON.stringify(draft) !== JSON.stringify(toDraft(saved));
  });
  /** "APC-000051" with the prefix being typed. */
  protected readonly nextCode = computed(() => {
    const saved = this.saved();
    const prefix = this.draft()?.prefix || saved?.prefix || '';
    return saved ? `${prefix}-${saved.nextCode.split('-').pop()}` : '';
  });

  constructor() {
    inject(UnsavedChanges).track(this.dirty);
    inject(DestroyRef).onDestroy(() => this.showPreview(null));
    void this.load();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected patch(change: Partial<ReceiptSettingsInput>): void {
    this.draft.update((d) => (d ? { ...d, ...change } : d));
  }

  protected setMode(value: string): void {
    this.patch({ mode: value as ReceiptMode });
  }

  protected setPrefix(event: Event): void {
    const input = event.target as HTMLInputElement;
    const prefix = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    input.value = prefix;
    this.patch({ prefix });
  }

  protected reset(): void {
    const saved = this.saved();
    if (saved) this.draft.set(toDraft(saved));
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    const tenantId = this.session.tenant()?.id;
    if (!draft || !tenantId || !this.remote || this.saving()) return;
    if (!draft.prefix) return this.toaster.show('Escribe el prefijo del número, por ejemplo APC.', 'info');
    this.saving.set(true);
    try {
      this.apply(await this.remote.save(tenantId, draft));
      this.toaster.show(draft.mode === 'off' ? 'Guardado: tus clientes no recibirán recibo' : 'Recibo guardado');
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.saving.set(false);
    }
  }

  protected async pickLogo(file: File): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!tenantId || !this.remote || this.uploading()) return;
    const picture = await readPicture(file, MAX_LOGO_BYTES);
    if (!picture) return this.toaster.show('El logo debe ser una imagen PNG o JPG de hasta 1 MB.', 'info');
    await this.updateLogo(() => this.remote!.setLogo(tenantId, picture), 'Logo cargado');
  }

  /** Saved at once, so it asks first; the dialog waits with its circle while the server answers. */
  protected async removeLogo(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    const remote = this.remote;
    if (!tenantId || !remote || this.uploading()) return;
    const removed = await this.confirm.ask({
      title: '¿Quitar el logo del recibo?',
      message: 'Los próximos recibos saldrán sin logo. Puedes subir otro cuando quieras.',
      confirmLabel: 'Quitar logo',
      danger: true,
      action: async () => {
        const settings = await remote.clearLogo(tenantId);
        this.saved.update((s) => (s ? { ...s, hasLogo: settings.hasLogo } : settings));
      },
    });
    if (!removed) return;
    void this.loadPreview();
    this.toaster.show('Logo quitado');
  }

  protected retry(): void {
    this.loadError.set(null);
    void this.load();
  }

  /** The logo saves on its own; whatever else is being edited stays as it is. */
  private async updateLogo(change: () => Promise<ReceiptSettings>, done: string): Promise<void> {
    this.uploading.set(true);
    try {
      const settings = await change();
      this.saved.update((s) => (s ? { ...s, hasLogo: settings.hasLogo } : settings));
      void this.loadPreview();
      this.toaster.show(done);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.uploading.set(false);
    }
  }

  private apply(settings: ReceiptSettings): void {
    this.saved.set(settings);
    this.draft.set(toDraft(settings));
    if (settings.mode === 'vortomi') void this.loadPreview();
  }

  private async load(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    try {
      this.apply(await this.remote.get(tenantId));
    } catch (error) {
      this.loadError.set(toApiFailure(error).message);
    }
  }

  private async loadPreview(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    try {
      this.showPreview(URL.createObjectURL(await this.remote.preview(tenantId)));
    } catch {
      // Secondary: the settings work without their preview.
    }
  }

  private showPreview(url: string | null): void {
    const old = this.preview();
    if (old) URL.revokeObjectURL(old);
    this.preview.set(url);
  }
}
