import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { Icon, type IconName } from './icon';

export interface MenuOption {
  value: string;
  label: string;
  icon?: IconName;
}

/** Shared with MultiSelectMenu, so both menus look the same. */
export const MENU_STYLES = `
    :host { position: relative; display: block; }
    .trigger { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 6px 12px; text-align: left; font: inherit; font-size: 14px;
      color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border-strong); border-radius: 10px; cursor: pointer; }
    .trigger:hover { border-color: var(--color-text-faint); }
    .trigger.open, .trigger:focus-visible { outline: 0; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .placeholder { color: var(--color-text-faint); }
    .chev { --icon-size: 16px; color: var(--color-text-muted); }
    .ic { width: 28px; height: 28px; flex-shrink: 0; border-radius: 8px; background: var(--color-surface-muted); color: var(--color-text-muted);
      display: flex; align-items: center; justify-content: center; --icon-size: 16px; }
    .panel { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; right: 0; background: var(--color-surface);
      border: 1px solid var(--color-border-strong); border-radius: 12px; box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14); padding: 6px; }
    .search { display: flex; align-items: center; gap: 8px; padding: 2px 8px 8px; border-bottom: 1px solid var(--color-border-soft); margin-bottom: 4px;
      color: var(--color-text-faint); --icon-size: 15px; }
    .search input { flex: 1; border: 0; outline: 0; background: none; font: inherit; font-size: 13.5px; padding: 6px 0; color: var(--color-text); }
    ul { list-style: none; margin: 0; padding: 0; max-height: 280px; overflow-y: auto; outline: 0; }
    li { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 8px; font-size: 13.5px; cursor: pointer; }
    li.active { background: var(--color-surface-muted); }
    li.on { color: var(--color-primary-strong); font-weight: 600; }
    li.on .ic { background: var(--color-primary); color: #fff; }
    .tick { --icon-size: 15px; color: var(--color-primary); }
    .none { color: var(--color-text-muted); cursor: default; }
  `;

export const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/**
 * Our own dropdown, in place of the browser's: the chosen option with its icon, a search box
 * for long lists, and the chosen one marked. Keyboard: arrows move, Enter picks, Escape closes;
 * a click outside closes it too.
 */
@Component({
  selector: 'app-select-menu',
  imports: [Icon],
  template: `
    <button type="button" class="trigger" [class.open]="open()" [attr.aria-label]="label()" aria-haspopup="listbox" [attr.aria-expanded]="open()" (click)="toggle()">
      @if (selected(); as s) {
        @if (s.icon) { <span class="ic"><app-icon [name]="s.icon" /></span> }
        <span class="value">{{ s.label }}</span>
      } @else {
        <span class="value placeholder">{{ placeholder() }}</span>
      }
      <app-icon name="down" class="chev" />
    </button>
    @if (open()) {
      <div class="panel">
        @if (searchable()) {
          <label class="search"><app-icon name="search" />
            <input #box type="search" aria-label="Buscar" placeholder="Buscar…" [value]="query()" (input)="filter($event)" (keydown)="onKey($event)" />
          </label>
        }
        <ul role="listbox" [attr.aria-label]="label()" tabindex="-1" (keydown)="onKey($event)">
          @for (option of shown(); track option.value; let i = $index) {
            <li role="option" [attr.aria-selected]="option.value === value()" [class.on]="option.value === value()" [class.active]="i === active()"
              (mouseenter)="active.set(i)" (click)="pick(option.value)">
              @if (option.icon) { <span class="ic"><app-icon [name]="option.icon" /></span> }
              <span class="value">{{ option.label }}</span>
              @if (option.value === value()) { <app-icon name="check" class="tick" /> }
            </li>
          } @empty {
            <li class="none">Nada coincide.</li>
          }
        </ul>
      </div>
    }
  `,
  styles: MENU_STYLES,
  host: { '(document:click)': 'onOutside($event)' },
})
export class SelectMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input.required<MenuOption[]>();
  readonly value = input<string | null>(null);
  readonly label = input('Elegir');
  readonly placeholder = input('Elige…');
  readonly searchable = input(false);
  readonly picked = output<string>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly selected = computed(() => this.options().find((o) => o.value === this.value()) ?? null);
  protected readonly shown = computed(() => {
    const needle = normalize(this.query());
    return needle ? this.options().filter((o) => normalize(o.label).includes(needle)) : this.options();
  });

  protected toggle(): void {
    if (this.open()) return this.close();
    this.query.set('');
    this.active.set(Math.max(0, this.options().findIndex((o) => o.value === this.value())));
    this.open.set(true);
    // Focus the search (or the list) once it is drawn, so typing filters right away.
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.panel input, .panel ul')?.focus());
  }

  protected filter(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected pick(value: string): void {
    this.picked.emit(value);
    this.close();
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.shown().length;
    if (event.key === 'Escape') return this.close();
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = this.shown()[this.active()];
      if (option) this.pick(option.value);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (count) this.active.update((i) => (i + (event.key === 'ArrowDown' ? 1 : -1) + count) % count);
  }

  protected onOutside(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  /** Back to the trigger after a choice or Escape; not when the person clicked somewhere else. */
  private close(refocus = true): void {
    this.open.set(false);
    if (refocus) this.host.nativeElement.querySelector<HTMLElement>('.trigger')?.focus();
  }
}
