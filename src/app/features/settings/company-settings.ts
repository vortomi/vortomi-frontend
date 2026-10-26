import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { TIMEZONES, WEEKDAYS } from '../../shared/api/labels';
import type { DayHours, WorkMode } from '../../shared/api/models';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { parsePriceCents } from '../../shared/format/money';
import { Toaster } from '../../shared/ui/toaster';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { SettingsActions } from './settings.actions';
import { fullWeek, hoursError, logoError } from './settings.rules';

interface CompanyForm {
  name: string;
  timezone: string;
  logo: string | null;
  hours: DayHours[];
  away: string;
  rate: string;
  workMode: WorkMode;
}

const WORK_MODES: { id: WorkMode; title: string; detail: string }[] = [
  { id: 'sales_and_support', title: 'Ventas y atención', detail: 'Bandeja, pipeline, inventario y ventas en reportes. Es lo normal.' },
  { id: 'support_only', title: 'Solo atención', detail: 'Bandeja y contactos. Oculta el pipeline y el inventario.' },
];

/** The company's general settings: shown read-only, changed only after «Editar» and kept with «Guardar». */
@Component({
  selector: 'app-company-settings',
  imports: [Avatar, Icon],
  template: `
    @let f = form();
    <div class="bar">
      @if (editing()) {
        <span class="hint">Editando · los cambios se aplican al pulsar «Guardar».</span>
        <button type="button" class="btn" [disabled]="saving()" (click)="cancel()">Cancelar</button>
        <button type="button" class="btn btn--primary" [disabled]="hasErrors() || saving()" [attr.aria-busy]="saving()" (click)="save()">
          @if (saving()) { <span class="spinner" aria-hidden="true"></span> } @else { <app-icon name="check" /> }
          Guardar
        </button>
      } @else {
        <button type="button" class="btn btn--primary" (click)="edit()"><app-icon name="edit" />Editar</button>
      }
    </div>

    <section class="card box">
      <h2>Empresa</h2>
      @if (!editing()) {
        <dl class="facts">
          <dt>Nombre comercial</dt><dd>{{ f.name }}</dd>
          <dt>Zona horaria</dt><dd>{{ timezoneLabel(f.timezone) }}</dd>
          <dt>Tasa del día</dt><dd>{{ f.rate ? f.rate + ' Bs por dólar' : 'Sin tasa: precios solo en dólares' }}</dd>
        </dl>
      } @else {
        @if (logoEditable) {
          <div class="logo-row">
            @if (f.logo; as src) {
              <img class="logo" [src]="src" alt="Logo de la empresa" />
            } @else {
              <app-avatar size="lg" class="logo" [name]="f.name || '?'" [seed]="session.tenant()?.id" />
            }
            <div class="field">
              <label for="logo">Logo</label>
              <input id="logo" type="file" accept="image/png,image/jpeg,image/webp" (change)="onLogo($event)" />
              <p class="field-hint">PNG, JPG o WebP de hasta 500 KB. Se ve en el panel de tu equipo.</p>
              @if (f.logo) { <button type="button" class="link danger" (click)="patch({ logo: null })">Quitar logo</button> }
            </div>
          </div>
        }
        <div class="g2">
          <div class="field">
            <label for="company-name">Nombre comercial</label>
            <input id="company-name" class="input" maxlength="80" [value]="f.name" (input)="patch({ name: value($event) })" />
          </div>
          <div class="field">
            <label for="tz">Zona horaria</label>
            <select id="tz" class="input" (change)="patch({ timezone: value($event) })">
              @for (tz of timezones; track tz[0]) {
                <option [value]="tz[0]" [selected]="tz[0] === f.timezone">{{ tz[1] }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="rate">Tasa del día (bolívares por dólar)</label>
            <input id="rate" class="input" inputmode="decimal" placeholder="Vacío: precios solo en dólares" [value]="f.rate" (input)="patch({ rate: value($event) })" />
            <p class="field-hint">Los precios se cargan en dólares; con la tasa también se muestran en bolívares.</p>
            @if (rateInvalid()) { <span class="field-error">Escribe un número, por ejemplo 185,50.</span> }
          </div>
        </div>
      }
    </section>

    <section class="card box">
      <h2>Cómo trabaja la empresa</h2>
      @if (!editing()) {
        <p class="mode-read"><b>{{ modeOf(f.workMode).title }}</b> · {{ modeOf(f.workMode).detail }}</p>
      } @else {
        <div class="modes" role="radiogroup" aria-label="Cómo trabaja la empresa">
          @for (option of workModes; track option.id) {
            <label class="mode" [class.on]="f.workMode === option.id">
              <input type="radio" name="work-mode" [checked]="f.workMode === option.id" (change)="patch({ workMode: option.id })" />
              <span><b>{{ option.title }}</b><small>{{ option.detail }}</small></span>
            </label>
          }
        </div>
      }
    </section>

    <section class="card box">
      <h2>Horario de atención</h2>
      @if (!editing()) {
        <dl class="facts">
          @for (day of f.hours; track day.day) {
            <dt>{{ weekdays[day.day] }}</dt>
            <dd>{{ day.open !== null ? day.open + ' a ' + day.close : 'Cerrado' }}</dd>
          }
          <dt>Fuera de horario</dt>
          <dd>{{ f.away || 'No se envía ningún mensaje automático.' }}</dd>
        </dl>
      } @else {
        <p class="field-hint">Fuera de este horario se envía el mensaje automático de abajo, si lo escribes.</p>
        <div class="rows">
          @for (day of f.hours; track day.day; let i = $index) {
            <div class="row">
              <label class="checkbox day"><input type="checkbox" [checked]="day.open !== null" (change)="toggleDay(i)" />{{ weekdays[day.day] }}</label>
              @if (day.open !== null) {
                <input type="time" class="input time" [attr.aria-label]="'Abre el ' + weekdays[day.day]" [value]="day.open" (change)="setTime(i, 'open', $event)" />
                <span class="muted">a</span>
                <input type="time" class="input time" [attr.aria-label]="'Cierra el ' + weekdays[day.day]" [value]="day.close" (change)="setTime(i, 'close', $event)" />
                @if (dayError(day); as message) { <span class="field-error">{{ message }}</span> }
              } @else {
                <span class="muted">Cerrado</span>
              }
            </div>
          }
        </div>
        <div class="field">
          <label for="away">Mensaje fuera de horario</label>
          <textarea id="away" class="input" rows="3" [value]="f.away" (input)="patch({ away: value($event) })"></textarea>
          <p class="field-hint">Es una respuesta: entra en las 1.000 gratis que da Meta a cada número al mes. Déjalo vacío para no enviar nada.</p>
        </div>
      }
    </section>
  `,
  styleUrl: '../../shared/ui/section.scss',
  styles: `
    .bar { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-bottom: 14px; }
    .bar .hint { margin-right: auto; font-size: 12.5px; color: var(--color-text-muted); }
    .logo-row { display: flex; gap: 16px; align-items: center; }
    .logo { width: 64px; height: 64px; border-radius: 14px; object-fit: cover; }
    .g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; }
    .day { width: 130px; }
    .time { width: 120px; }
    .mode-read { font-size: 13.5px; color: var(--color-text-2); }
    .modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .mode { display: flex; gap: 10px; align-items: flex-start; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md);
      padding: 10px 12px; cursor: pointer; }
    .mode.on { border-color: var(--color-primary); background: var(--color-primary-softer); box-shadow: 0 0 0 1px var(--color-primary); }
    .mode input { margin-top: 3px; accent-color: var(--color-primary); }
    .mode b { display: block; font-size: 13.5px; } .mode small { font-size: 12px; color: var(--color-text-muted); }
    @media (max-width: 760px) { .modes, .g2 { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class CompanySettings {
  protected readonly session = inject(Session);
  private readonly workspace = inject(Workspace);
  private readonly actions = inject(SettingsActions);
  private readonly toaster = inject(Toaster);

  protected readonly logoEditable = this.actions.logoEditable;
  protected readonly timezones = TIMEZONES;
  protected readonly weekdays = WEEKDAYS;
  protected readonly workModes = WORK_MODES;

  /** What is saved; the form starts from it and «Cancelar» goes back to it. */
  private readonly saved = computed<CompanyForm>(() => {
    const tenant = this.session.tenant();
    const settings = this.workspace.settings();
    return {
      name: tenant?.name ?? '',
      timezone: tenant?.timezone ?? 'America/Caracas',
      logo: settings?.logoDataUrl ?? null,
      hours: fullWeek(settings?.businessHours ?? []),
      away: settings?.awayMessage ?? '',
      rate: settings?.exchangeRateVes ? String(settings.exchangeRateVes).replace('.', ',') : '',
      workMode: settings?.workMode ?? 'sales_and_support',
    };
  });
  protected readonly form = signal<CompanyForm>(this.saved());
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  private readonly dirty = computed(() => this.editing() && JSON.stringify(this.form()) !== JSON.stringify(this.saved()));

  private readonly parsedRate = computed(() => {
    const raw = this.form().rate.trim();
    if (!raw) return null;
    const cents = parsePriceCents(raw);
    return cents === null ? NaN : cents / 100;
  });
  protected readonly rateInvalid = computed(() => Number.isNaN(this.parsedRate()));
  protected readonly hasErrors = computed(() => !this.form().name.trim() || this.form().hours.some((h) => hoursError(h)) || this.rateInvalid());

  constructor() {
    inject(UnsavedChanges).track(this.dirty);
    // While reading, the view follows what is saved (it may arrive after the screen opens).
    effect(() => {
      const saved = this.saved();
      if (!untracked(this.editing)) this.form.set(saved);
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected patch(change: Partial<CompanyForm>): void {
    this.form.update((f) => ({ ...f, ...change }));
  }

  protected timezoneLabel(id: string): string {
    return TIMEZONES.find((tz) => tz[0] === id)?.[1] ?? id;
  }

  protected modeOf(id: WorkMode): (typeof WORK_MODES)[number] {
    return WORK_MODES.find((m) => m.id === id) ?? WORK_MODES[0]!;
  }

  protected dayError(day: DayHours): string | null {
    return hoursError(day);
  }

  protected edit(): void {
    this.form.set(this.saved());
    this.editing.set(true);
  }

  protected cancel(): void {
    this.form.set(this.saved());
    this.editing.set(false);
  }

  protected toggleDay(index: number): void {
    this.patch({
      hours: this.form().hours.map((h, i) => (i !== index ? h : h.open === null ? { ...h, open: '08:00', close: '17:00' } : { ...h, open: null, close: null })),
    });
  }

  protected setTime(index: number, key: 'open' | 'close', event: Event): void {
    const value = this.value(event);
    this.patch({ hours: this.form().hours.map((h, i) => (i === index ? { ...h, [key]: value } : h)) });
  }

  protected onLogo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const error = logoError(file);
    if (error) {
      this.toaster.show(error, 'info');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.patch({ logo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  protected async save(): Promise<void> {
    const settings = this.workspace.settings();
    if (!settings || this.hasErrors() || this.saving()) return;
    const f = this.form();
    this.saving.set(true);
    const ok = await this.actions.saveCompany(f.name, f.timezone, {
      ...settings,
      logoDataUrl: f.logo,
      businessHours: f.hours,
      awayMessage: f.away.trim(),
      exchangeRateVes: this.parsedRate(),
      workMode: f.workMode,
    });
    this.saving.set(false);
    if (!ok) return;
    this.editing.set(false);
    this.form.set(this.saved());
    this.toaster.show('Ajustes guardados');
  }
}
