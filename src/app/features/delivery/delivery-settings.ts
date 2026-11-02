import { Component, computed, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { DeliveryMode, DeliverySettings } from '../../shared/api/models';
import { parsePriceCents } from '../../shared/format/money';
import { Icon } from '../../shared/ui/icon';
import { type OptionCard, OptionCards } from '../../shared/ui/option-cards';
import { Toaster } from '../../shared/ui/toaster';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { type DeliveryInput, DeliveryRemote } from './delivery-remote';

const MODES: (OptionCard & { value: DeliveryMode })[] = [
  { value: 'zones', label: 'Precio por zona', icon: 'tag', hint: 'Cada zona con su propio precio' },
  { value: 'flat', label: 'Precio fijo', icon: 'dollar', hint: 'El mismo precio a cualquier dirección' },
];
const MAX_ZONES = 100;

/** What the form holds: prices as typed ("1,50"), turned into cents on save. */
interface Draft {
  enabled: boolean;
  mode: DeliveryMode;
  flatPrice: string;
  zones: { name: string; price: string }[];
}

/** "1,50" from 150 cents: how a price shows in its box. */
const priceText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
/** Typed price to cents; "0" is a free delivery. Null when it does not read as a price. */
const toCents = (text: string): number | null => (/^\s*0+([.,]0*)?\s*$/.test(text) ? 0 : parsePriceCents(text));

const toDraft = (s: DeliverySettings): Draft => ({
  enabled: s.enabled,
  mode: s.mode,
  flatPrice: s.configured || s.flatPriceCents ? priceText(s.flatPriceCents) : '',
  zones: s.zones.map((z) => ({ name: z.name, price: priceText(z.priceCents) })),
});

/**
 * «Ajustes → Delivery»: whether the company delivers and what it costs, one price everywhere or a
 * price per zone. The sales agent tells customers exactly this. Admins only; server only.
 */
@Component({
  selector: 'app-delivery-settings',
  imports: [Icon, OptionCards],
  template: `
    @if (!remote) {
      <section class="card box"><p class="lead">El delivery se configura con el servidor.</p></section>
    } @else if (draft(); as d) {
      <section class="card box head">
        <span class="badge" [class.on]="d.enabled"><app-icon name="package" /></span>
        <div class="grow">
          <h2>{{ d.enabled ? 'Delivery activo' : 'Delivery inactivo' }}</h2>
          <p class="lead">{{ d.enabled ? 'Llevas los pedidos a domicilio. El agente les dice a tus clientes cuánto cuesta.' : 'Tus clientes retiran sus pedidos en la tienda.' }}</p>
        </div>
        <button type="button" role="switch" class="switch" [class.on]="d.enabled" [attr.aria-checked]="d.enabled" aria-label="Activar el delivery"
          (click)="patch({ enabled: !d.enabled })"><span class="knob"></span></button>
      </section>

      @if (d.enabled) {
        <section class="card box">
          <div class="field">
            <span class="label">Cómo cobras el delivery</span>
            <app-option-cards label="Cómo cobras el delivery" [options]="modes" [value]="d.mode" (picked)="setMode($event)" />
          </div>

          @if (d.mode === 'flat') {
            <div class="field">
              <label for="flat-price">Precio del delivery (USD)</label>
              <input id="flat-price" class="input price" inputmode="decimal" placeholder="0,00" [value]="d.flatPrice" (input)="patch({ flatPrice: value($event) })" />
              <p class="field-hint">Se suma al pedido, a cualquier dirección. 0 si es gratis.</p>
            </div>
          } @else {
            <div class="field">
              <span class="label">Zonas</span>
              @if (d.zones.length) {
                <div class="zones">
                  <div class="zone legend"><span>Zona</span><span>Precio (USD)</span><span></span></div>
                  @for (zone of d.zones; track $index; let i = $index) {
                    <div class="zone">
                      <input class="input" maxlength="40" placeholder="Centro" [attr.aria-label]="'Nombre de la zona ' + (i + 1)" [value]="zone.name" (input)="setZone(i, { name: value($event) })" />
                      <input class="input price" inputmode="decimal" placeholder="0,00" [attr.aria-label]="'Precio de la zona ' + (i + 1)" [value]="zone.price" (input)="setZone(i, { price: value($event) })" />
                      <button type="button" class="icon-btn" [attr.aria-label]="'Quitar la zona ' + (zone.name || i + 1)" (click)="removeZone(i)"><app-icon name="x" /></button>
                    </div>
                  }
                </div>
              } @else {
                <p class="empty">Todavía no hay zonas. Agrega las zonas donde llevas pedidos, cada una con su precio.</p>
              }
              <button type="button" class="btn add" [disabled]="d.zones.length >= maxZones" (click)="addZone()"><app-icon name="plus" />Agregar zona</button>
              <p class="field-hint">Si un cliente está en una zona que no está en la lista, el agente le dice que una persona confirma el costo.</p>
            </div>
          }
        </section>
      }

      @if (error(); as message) { <p class="field-error" role="alert">{{ message }}</p> }
      <div class="actions">
        @if (dirty()) { <button type="button" class="btn" [disabled]="saving()" (click)="reset()">Descartar</button> }
        <button type="button" class="btn btn--primary" [disabled]="saving() || !dirty()" [attr.aria-busy]="saving()" (click)="save()">
          @if (saving()) { <span class="spinner" aria-hidden="true"></span> } @else { <app-icon name="check" /> }
          Guardar
        </button>
      </div>
    } @else {
      <section class="card box"><p class="lead">Cargando…</p></section>
    }
  `,
  styleUrls: ['../../shared/ui/section.scss'],
  styles: `
    .head { flex-direction: row; align-items: center; gap: 14px; }
    .grow { flex: 1; min-width: 0; }
    .lead { color: var(--color-text-muted); font-size: 13px; margin-top: 2px; }
    .badge { width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      background: var(--color-surface-muted); color: var(--color-text-muted); --icon-size: 22px; }
    .badge.on { background: var(--color-primary); color: #fff; }
    .switch { width: 44px; height: 24px; flex-shrink: 0; border: 0; border-radius: 999px; background: var(--color-border-strong); position: relative; cursor: pointer;
      transition: background 0.15s; }
    .switch.on { background: var(--color-primary); }
    .switch:focus-visible { outline: 0; box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
    .switch.on .knob { transform: translateX(20px); }
    .label { font-size: 13px; font-weight: 600; color: var(--color-text-2); }
    .price { max-width: 140px; }
    .zones { display: flex; flex-direction: column; gap: 8px; }
    .zone { display: grid; grid-template-columns: minmax(0, 1fr) 140px 36px; gap: 8px; align-items: center; }
    .legend span { font-size: 12px; color: var(--color-text-muted); }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-muted);
      display: flex; align-items: center; justify-content: center; cursor: pointer; --icon-size: 16px; }
    .icon-btn:hover { color: var(--color-danger); border-color: currentColor; }
    .empty { font-size: 13px; color: var(--color-text-muted); }
    .add { align-self: flex-start; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; }
  `,
})
export class DeliverySettingsPage {
  protected readonly remote = inject(API_CONFIG).mode === 'api' ? inject(DeliveryRemote) : null;
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);

  protected readonly modes = MODES;
  protected readonly maxZones = MAX_ZONES;
  protected readonly saved = signal<DeliverySettings | null>(null);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dirty = computed(() => {
    const saved = this.saved();
    const draft = this.draft();
    return !!saved && !!draft && (!saved.configured || JSON.stringify(draft) !== JSON.stringify(toDraft(saved)));
  });

  constructor() {
    inject(UnsavedChanges).track(this.dirty);
    void this.load();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected patch(change: Partial<Draft>): void {
    this.draft.update((d) => (d ? { ...d, ...change } : d));
    this.error.set(null);
  }

  protected setMode(value: string): void {
    this.patch({ mode: value as DeliveryMode });
  }

  protected setZone(index: number, change: Partial<Draft['zones'][number]>): void {
    const zones = this.draft()?.zones ?? [];
    this.patch({ zones: zones.map((z, i) => (i === index ? { ...z, ...change } : z)) });
  }

  protected addZone(): void {
    this.patch({ zones: [...(this.draft()?.zones ?? []), { name: '', price: '' }] });
  }

  protected removeZone(index: number): void {
    this.patch({ zones: (this.draft()?.zones ?? []).filter((_, i) => i !== index) });
  }

  protected reset(): void {
    const saved = this.saved();
    if (saved) this.draft.set(toDraft(saved));
    this.error.set(null);
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    const tenantId = this.session.tenant()?.id;
    if (!draft || !tenantId || !this.remote || this.saving()) return;
    const input = this.toInput(draft);
    if (typeof input === 'string') return this.error.set(input);
    this.saving.set(true);
    try {
      const saved = await this.remote.save(tenantId, input);
      this.saved.set(saved);
      this.draft.set(toDraft(saved));
      this.toaster.show(saved.enabled ? 'Delivery guardado: el agente ya lo informa' : 'Delivery guardado: inactivo');
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.saving.set(false);
    }
  }

  /** The request, or what to fix first. Only what is in use is checked. */
  private toInput(draft: Draft): DeliveryInput | string {
    const flatPriceCents = draft.flatPrice.trim() ? toCents(draft.flatPrice) : 0;
    if (draft.enabled && draft.mode === 'flat' && (flatPriceCents === null || !draft.flatPrice.trim())) return 'Escribe el precio del delivery, por ejemplo 1,50 (0 si es gratis).';
    const zones: DeliveryInput['zones'] = [];
    const seen = new Set<string>();
    for (const zone of draft.zones) {
      const name = zone.name.trim();
      if (!name && !zone.price.trim()) continue;
      if (!name) return 'Hay una zona sin nombre: escríbelo o quítala.';
      const key = name.toLowerCase();
      if (seen.has(key)) return `La zona «${name}» está repetida.`;
      seen.add(key);
      const priceCents = toCents(zone.price);
      if (priceCents === null) return `Escribe el precio de «${name}», por ejemplo 1,50 (0 si es gratis).`;
      zones.push({ name, priceCents });
    }
    return { enabled: draft.enabled, mode: draft.mode, flatPriceCents: flatPriceCents ?? 0, zones };
  }

  private async load(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    try {
      const saved = await this.remote.get(tenantId);
      this.saved.set(saved);
      this.draft.set(toDraft(saved));
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    }
  }
}
