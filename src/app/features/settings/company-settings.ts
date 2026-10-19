import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { TIMEZONES, WEEKDAYS } from '../../shared/api/labels';
import type { DayHours, WorkMode } from '../../shared/api/models';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { parsePriceCents } from '../../shared/format/money';
import { Toaster } from '../../shared/ui/toaster';
import { SettingsActions } from './settings.actions';
import { hoursError, logoError } from './settings.rules';

@Component({
  selector: 'app-company-settings',
  imports: [Avatar, Icon],
  template: `
    <section class="card box">
      <h2>Empresa</h2>
      <div class="logo-row">
        @if (logo(); as src) {
          <img class="logo" [src]="src" alt="Logo de la empresa" />
        } @else {
          <app-avatar size="lg" class="logo" [name]="name() || '?'" [seed]="session.tenant()?.id" />
        }
        <div class="field">
          <label for="logo">Logo</label>
          <input id="logo" type="file" accept="image/png,image/jpeg,image/webp" (change)="onLogo($event)" />
          <p class="field-hint">PNG, JPG o WebP de hasta 500 KB. Se ve en el panel de tu equipo.</p>
          @if (logo()) { <button type="button" class="link danger" (click)="logo.set(null)">Quitar logo</button> }
        </div>
      </div>
      <div class="g2">
        <div class="field">
          <label for="company-name">Nombre comercial</label>
          <input id="company-name" class="input" [value]="name()" (input)="name.set(value($event))" />
        </div>
        <div class="field">
          <label for="tz">Zona horaria</label>
          <select id="tz" class="input" (change)="timezone.set(value($event))">
            @for (tz of timezones; track tz[0]) {
              <option [value]="tz[0]" [selected]="tz[0] === timezone()">{{ tz[1] }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="rate">Tasa del día (bolívares por dólar)</label>
          <input id="rate" class="input" inputmode="decimal" placeholder="Vacío: precios solo en dólares" [value]="rate()" (input)="rate.set(value($event))" />
          <p class="field-hint">Los precios se cargan en dólares; con la tasa también se muestran en bolívares.</p>
          @if (rateInvalid()) { <span class="field-error">Escribe un número, por ejemplo 185,50.</span> }
        </div>
      </div>
    </section>

    <section class="card box">
      <h2>Cómo trabaja la empresa</h2>
      <div class="modes" role="radiogroup" aria-label="Cómo trabaja la empresa">
        @for (option of workModes; track option.id) {
          <label class="mode" [class.on]="workMode() === option.id">
            <input type="radio" name="work-mode" [checked]="workMode() === option.id" (change)="workMode.set(option.id)" />
            <span><b>{{ option.title }}</b><small>{{ option.detail }}</small></span>
          </label>
        }
      </div>
    </section>

    <section class="card box">
      <h2>Horario de atención</h2>
      <p class="field-hint">Fuera de este horario se envía el mensaje automático de abajo, si lo escribes.</p>
      <div class="rows">
        @for (day of hours(); track day.day; let i = $index) {
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
        <textarea id="away" class="input" rows="3" [value]="away()" (input)="away.set(value($event))"></textarea>
        <p class="field-hint">Es una respuesta: entra en las 1.000 gratis que da Meta a cada número al mes. Déjalo vacío para no enviar nada.</p>
      </div>
    </section>

    <div class="actions">
      <button type="button" class="btn btn--primary" [disabled]="hasErrors()" (click)="save()"><app-icon name="check" />Guardar cambios</button>
    </div>
  `,
  styleUrl: './settings-section.scss',
  styles: `
    .logo-row { display: flex; gap: 16px; align-items: center; }
    .logo { width: 64px; height: 64px; border-radius: 14px; object-fit: cover; }
    .g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; }
    .day { width: 130px; }
    .time { width: 120px; }
    .modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .mode { display: flex; gap: 10px; align-items: flex-start; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md);
      padding: 10px 12px; cursor: pointer; }
    .mode.on { border-color: var(--color-primary); background: var(--color-primary-softer); box-shadow: 0 0 0 1px var(--color-primary); }
    .mode input { margin-top: 3px; accent-color: var(--color-primary); }
    .mode b { display: block; font-size: 13.5px; } .mode small { font-size: 12px; color: var(--color-text-muted); }
    @media (max-width: 760px) { .modes { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class CompanySettings {
  protected readonly session = inject(Session);
  private readonly workspace = inject(Workspace);
  private readonly actions = inject(SettingsActions);
  private readonly toaster = inject(Toaster);

  protected readonly timezones = TIMEZONES;
  protected readonly weekdays = WEEKDAYS;
  protected readonly name = signal('');
  protected readonly timezone = signal('America/Caracas');
  protected readonly logo = signal<string | null>(null);
  protected readonly hours = signal<DayHours[]>([]);
  protected readonly away = signal('');
  protected readonly rate = signal('');
  protected readonly workMode = signal<WorkMode>('sales_and_support');
  protected readonly workModes: { id: WorkMode; title: string; detail: string }[] = [
    { id: 'sales_and_support', title: 'Ventas y atención', detail: 'Bandeja, pipeline, inventario y ventas en reportes. Es lo normal.' },
    { id: 'support_only', title: 'Solo atención', detail: 'Bandeja y contactos. Oculta el pipeline y el inventario.' },
  ];
  private readonly parsedRate = computed(() => {
    const raw = this.rate().trim();
    if (!raw) return null;
    const cents = parsePriceCents(raw);
    return cents === null ? NaN : cents / 100;
  });
  protected readonly rateInvalid = computed(() => Number.isNaN(this.parsedRate()));
  protected readonly hasErrors = computed(() => !this.name().trim() || this.hours().some((h) => hoursError(h)) || this.rateInvalid());

  constructor() {
    effect(() => {
      const tenant = this.session.tenant();
      const settings = this.workspace.settings();
      untracked(() => {
        this.name.set(tenant?.name ?? '');
        this.timezone.set(tenant?.timezone ?? 'America/Caracas');
        this.logo.set(settings?.logoDataUrl ?? null);
        this.hours.set(settings?.businessHours ?? []);
        this.away.set(settings?.awayMessage ?? '');
        this.rate.set(settings?.exchangeRateVes ? String(settings.exchangeRateVes).replace('.', ',') : '');
        this.workMode.set(settings?.workMode ?? 'sales_and_support');
      });
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected dayError(day: DayHours): string | null {
    return hoursError(day);
  }

  protected toggleDay(index: number): void {
    this.hours.update((list) =>
      list.map((h, i) => (i !== index ? h : h.open === null ? { ...h, open: '08:00', close: '17:00' } : { ...h, open: null, close: null })),
    );
  }

  protected setTime(index: number, key: 'open' | 'close', event: Event): void {
    const value = this.value(event);
    this.hours.update((list) => list.map((h, i) => (i === index ? { ...h, [key]: value } : h)));
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
    reader.onload = () => this.logo.set(String(reader.result));
    reader.readAsDataURL(file);
  }

  protected save(): void {
    const settings = this.workspace.settings();
    if (!settings || this.hasErrors()) return;
    this.actions.saveCompany(this.name(), this.timezone(), {
      ...settings,
      logoDataUrl: this.logo(),
      businessHours: this.hours(),
      awayMessage: this.away().trim(),
      exchangeRateVes: this.parsedRate(),
      workMode: this.workMode(),
    });
    this.toaster.show('Ajustes guardados');
  }
}
