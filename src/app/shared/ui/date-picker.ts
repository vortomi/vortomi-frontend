import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { Icon } from './icon';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

interface Day {
  iso: string;
  day: number;
  inMonth: boolean;
  disabled: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** "10 de noviembre de 2026" from "2026-11-10". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m! - 1]} de ${y}`;
}

/**
 * Our own date field, in place of <input type="date"> (mockup web-14): the chosen day in words and
 * a month calendar. Works with "YYYY-MM-DD" strings, so no time zone gets in the way. Keyboard:
 * the calendar days are buttons (Tab / Enter); Escape closes.
 */
@Component({
  selector: 'app-date-picker',
  imports: [Icon],
  host: { '(document:click)': 'onOutside($event)', '(keydown.escape)': 'close()' },
  template: `
    <button type="button" class="trigger" [class.open]="open()" [disabled]="disabled()" [attr.aria-label]="label()" aria-haspopup="dialog" [attr.aria-expanded]="open()" (click)="toggle()">
      <app-icon name="calendar" class="ic" />
      <span class="value" [class.placeholder]="!value()">{{ value() ? text(value()!) : placeholder() }}</span>
      <app-icon name="down" class="chev" />
    </button>
    @if (open()) {
      <div class="panel" role="dialog" [attr.aria-label]="label()">
        <div class="head">
          <button type="button" class="nav" aria-label="Mes anterior" (click)="shift(-1)"><app-icon name="chev-left" /></button>
          <b>{{ monthTitle() }}</b>
          <button type="button" class="nav" aria-label="Mes siguiente" (click)="shift(1)"><app-icon name="chev-right" /></button>
        </div>
        <div class="grid">
          @for (w of weekdays; track w) { <span class="dw">{{ w }}</span> }
          @for (d of days(); track d.iso) {
            <button type="button" [class.out]="!d.inMonth" [class.on]="d.iso === value()" [class.today]="d.iso === today()" [disabled]="d.disabled"
              [attr.aria-label]="text(d.iso)" [attr.aria-pressed]="d.iso === value()" (click)="pick(d.iso)">{{ d.day }}</button>
          }
        </div>
        @if (clearable() && value()) {
          <button type="button" class="link clear" (click)="pick(null)">Quitar fecha</button>
        }
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: block; }
    .trigger { display: flex; align-items: center; gap: 10px; width: 100%; height: 42px; padding: 0 12px; text-align: left; font: inherit; font-size: 14px;
      color: var(--color-text); background: var(--color-input); border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); cursor: pointer; }
    .trigger.open, .trigger:focus-visible { outline: 0; border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
    .trigger:disabled { opacity: 0.6; cursor: not-allowed; }
    .ic { --icon-size: 16px; color: var(--color-text-muted); }
    .value { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .placeholder { color: var(--color-text-faint); }
    .chev { --icon-size: 16px; color: var(--color-text-muted); }
    .panel { position: absolute; z-index: 40; top: calc(100% + 6px); left: 0; width: 300px; padding: 14px; background: var(--color-surface);
      border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-pop); }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .head b { font-size: 14px; text-transform: capitalize; }
    .nav { width: 32px; height: 32px; border: 0; background: none; border-radius: var(--radius-sm); cursor: pointer; color: var(--color-text-muted);
      display: inline-flex; align-items: center; justify-content: center; --icon-size: 16px; }
    .nav:hover { background: var(--color-surface-hover); color: var(--color-text); }
    .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .dw { height: 26px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: var(--color-text-muted); }
    .grid button { height: 34px; border: 0; background: none; border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-2); cursor: pointer; }
    .grid button:hover:not(:disabled) { background: var(--color-surface-hover); }
    .grid button.out { color: var(--color-text-faint); }
    .grid button.today { box-shadow: inset 0 0 0 1px var(--primary-300); }
    .grid button.on { background: var(--color-primary); color: var(--color-on-primary); font-weight: 600; }
    .grid button:disabled { color: var(--color-text-faint); opacity: 0.45; cursor: not-allowed; }
    .clear { margin-top: 10px; font-size: 13px; }
  `,
})
export class DatePicker {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** "YYYY-MM-DD" or null. */
  readonly value = input<string | null>(null);
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly label = input('Elegir fecha');
  readonly placeholder = input('Elige una fecha');
  readonly disabled = input(false);
  /** Offers "Quitar fecha" (optional dates). */
  readonly clearable = input(false);
  /** The day the calendar marks as today ("YYYY-MM-DD"); the browser's day when left out. */
  readonly todayIso = input<string | null>(null);
  readonly picked = output<string | null>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly open = signal(false);
  /** First day of the month on screen. */
  private readonly view = signal({ year: 2026, month: 0 });

  protected readonly today = computed(() => {
    if (this.todayIso()) return this.todayIso()!;
    const now = new Date();
    return isoOf(now.getFullYear(), now.getMonth(), now.getDate());
  });

  protected readonly monthTitle = computed(() => `${MONTHS[this.view().month]} ${this.view().year}`);

  protected readonly days = computed<Day[]>(() => {
    const { year, month } = this.view();
    // Weeks start on Monday.
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
    const start = new Date(year, month, 1 - lead);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = isoOf(date.getFullYear(), date.getMonth(), date.getDate());
      const disabled = (!!this.min() && iso < this.min()!) || (!!this.max() && iso > this.max()!);
      return { iso, day: date.getDate(), inMonth: date.getMonth() === month, disabled };
    });
  });

  protected text(iso: string): string {
    return longDate(iso);
  }

  protected toggle(): void {
    if (this.open()) return this.close();
    const [y, m] = (this.value() ?? this.today()).split('-').map(Number);
    this.view.set({ year: y!, month: m! - 1 });
    this.open.set(true);
  }

  protected shift(months: number): void {
    const { year, month } = this.view();
    const next = new Date(year, month + months, 1);
    this.view.set({ year: next.getFullYear(), month: next.getMonth() });
  }

  protected pick(iso: string | null): void {
    this.picked.emit(iso);
    this.close();
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.host.nativeElement.querySelector<HTMLElement>('.trigger')?.focus();
  }

  protected onOutside(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
