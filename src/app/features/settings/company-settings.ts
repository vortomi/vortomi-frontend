import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BusinessTypes } from '../../core/business-types';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { TIMEZONES, WEEKDAYS } from '../../shared/api/labels';
import type { DayHours, WorkMode } from '../../shared/api/models';
import { Avatar } from '../../shared/ui/avatar';
import { Confirm } from '../../shared/ui/confirm';
import { FileDrop } from '../../shared/ui/file-drop';
import { Icon } from '../../shared/ui/icon';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import { TimeSelect } from '../../shared/ui/time-select';
import { Toaster } from '../../shared/ui/toaster';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { SetupData } from '../setup/setup.data';
import { SettingsActions } from './settings.actions';
import { fullWeek, hoursError, logoError } from './settings.rules';

interface CompanyForm {
  name: string;
  timezone: string;
  logo: string | null;
  hours: DayHours[];
  away: string;
  workMode: WorkMode;
}

const WORK_MODES: { id: WorkMode; title: string; detail: string }[] = [
  { id: 'sales_and_support', title: 'Ventas y atención', detail: 'Bandeja, pipeline, inventario y ventas en reportes. Es lo normal.' },
  { id: 'support_only', title: 'Solo atención', detail: 'Bandeja y contactos. Oculta el pipeline y el inventario.' },
];

/** The company's general settings: shown read-only, changed only after «Editar» and kept with «Guardar». */
@Component({
  selector: 'app-company-settings',
  imports: [Avatar, Icon, RouterLink, SelectMenu, TimeSelect, FileDrop],
  template: `
    @let f = form();
    <div class="bar">
      @if (editing()) {
        <span class="hint">Editando · los cambios se aplican al pulsar «Guardar».</span>
        <button type="button" class="btn" [disabled]="saving()" (click)="cancel()"><span>Cancelar</span></button>
        <button type="button" class="btn btn--primary" [disabled]="hasErrors() || saving()" [attr.aria-busy]="saving()" (click)="save()">
          <app-icon name="check" /><span>Guardar</span>
        </button>
      } @else {
        <button type="button" class="btn btn--primary" (click)="edit()"><app-icon name="edit" /><span>Editar</span></button>
      }
    </div>

    @if (!editing()) {
      <section class="card box">
        <div class="setup">
          <span class="setup-ic"><app-icon name="wand" /></span>
          <div class="grow">
            <h2>Preparar según mi rubro</h2>
            <p class="setup-text">{{ setupText() }}</p>
          </div>
          <a class="btn" routerLink="/welcome"><span>Abrir la bienvenida</span></a>
        </div>
      </section>
    }

    <section class="card box">
      <h2>Empresa</h2>
      @if (!editing()) {
        <dl class="facts">
          <dt>Nombre comercial</dt><dd>{{ f.name }}</dd>
          <dt>Zona horaria</dt><dd>{{ timezoneLabel(f.timezone) }}</dd>
        </dl>
      } @else {
        @if (logoEditable) {
          <div class="logo-row">
            @if (f.logo; as src) {
              <img class="logo" [src]="src" alt="Logo de la empresa" />
            } @else {
              <app-avatar size="lg" class="logo" [name]="f.name || '?'" [seed]="session.tenant()?.id" />
            }
            <div class="field logo-field">
              <span class="label">Logo</span>
              <app-file-drop label="Elegir logo" accept="image/png,image/jpeg,image/webp" [compact]="true" (picked)="onLogo($event)" />
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
            <span class="label">Zona horaria</span>
            <app-select-menu label="Zona horaria" [options]="timezoneOptions" [value]="f.timezone" [searchable]="timezoneOptions.length > 7"
              (picked)="patch({ timezone: $event })" />
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
                <app-time-select class="time" [label]="'Abre el ' + weekdays[day.day]" [value]="day.open" (picked)="setTime(i, 'open', $event)" />
                <span class="muted">a</span>
                <app-time-select class="time" [label]="'Cierra el ' + weekdays[day.day]" [value]="day.close" (picked)="setTime(i, 'close', $event)" />
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
    .time { width: 160px; }
    .label { font-size: 14px; font-weight: 500; color: var(--color-text); }
    .logo-field { flex: 1; min-width: 0; align-items: flex-start; }
    .danger { color: var(--color-danger); }
    .mode-read { font-size: 13.5px; color: var(--color-text-2); }
    .setup { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .setup-ic { width: 40px; height: 40px; border-radius: 10px; background: var(--color-primary-soft); color: var(--color-primary-text);
      display: flex; align-items: center; justify-content: center; --icon-size: 20px; flex-shrink: 0; }
    .setup .grow { flex: 1; min-width: 220px; }
    .setup-text { font-size: 13px; color: var(--color-text-muted); margin-top: 2px; }
    .modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .mode { display: flex; gap: 10px; align-items: flex-start; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md);
      padding: 10px 12px; cursor: pointer; }
    .mode.on { border-color: var(--color-primary); background: var(--color-primary-softer); box-shadow: 0 0 0 1px var(--color-primary); }
    .mode input { margin-top: 2px; }
    .mode b { display: block; font-size: 13.5px; } .mode small { font-size: 12px; color: var(--color-text-muted); }
    @media (max-width: 760px) { .modes, .g2 { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class CompanySettings {
  protected readonly session = inject(Session);
  private readonly workspace = inject(Workspace);
  private readonly actions = inject(SettingsActions);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(Confirm);

  protected readonly logoEditable = this.actions.logoEditable;
  private readonly setup = inject(SetupData);
  private readonly businessTypes = inject(BusinessTypes);

  /** Where the company stands with the welcome, in one sentence. */
  protected readonly setupText = computed(() => {
    const status = this.setup.status();
    const label = this.businessTypes.labelOf(status?.businessType ?? null, status?.businessTypeOther ?? '');
    return label
      ? `Rubro: ${label}. Vuelve a hacer las 3 preguntas y agrega lo que falte, sin tocar lo que ya tienes.`
      : 'Todavía no respondiste la bienvenida: 3 preguntas para dejar tu panel listo según tu negocio.';
  });
  protected readonly timezoneOptions: MenuOption[] = TIMEZONES.map(([value, label]) => ({ value, label }));
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
      workMode: settings?.workMode ?? 'sales_and_support',
    };
  });
  protected readonly form = signal<CompanyForm>(this.saved());
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  private readonly dirty = computed(() => this.editing() && JSON.stringify(this.form()) !== JSON.stringify(this.saved()));

  protected readonly hasErrors = computed(() => !this.form().name.trim() || this.form().hours.some((h) => hoursError(h)));

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

  protected setTime(index: number, key: 'open' | 'close', value: string): void {
    this.patch({ hours: this.form().hours.map((h, i) => (i === index ? { ...h, [key]: value } : h)) });
  }

  protected onLogo(file: File): void {
    const error = logoError(file);
    if (error) return this.toaster.show(error, 'info');
    const reader = new FileReader();
    reader.onload = () => this.patch({ logo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  protected async save(): Promise<void> {
    const settings = this.workspace.settings();
    if (!settings || this.hasErrors() || this.saving()) return;
    const f = this.form();
    // Support only hides the pipeline and the inventory for the whole team: say it before it happens.
    if (f.workMode === 'support_only' && this.saved().workMode !== 'support_only') {
      const yes = await this.confirm.ask({
        title: '¿Cambiar a «Solo atención»?',
        message: 'El pipeline, el inventario y las ventas de los reportes se ocultan para todo el equipo. Lo puedes volver a cambiar cuando quieras; no se borra nada.',
        confirmLabel: 'Cambiar a Solo atención',
      });
      if (!yes) return;
    }
    this.saving.set(true);
    const ok = await this.actions.saveCompany(f.name, f.timezone, {
      ...settings,
      logoDataUrl: f.logo,
      businessHours: f.hours,
      awayMessage: f.away.trim(),
      workMode: f.workMode,
    });
    this.saving.set(false);
    if (!ok) return;
    this.editing.set(false);
    this.form.set(this.saved());
    this.toaster.show('Ajustes guardados');
  }
}
