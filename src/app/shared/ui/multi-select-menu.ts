import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { Icon } from './icon';
import { MENU_STYLES, type MenuOption, normalize } from './select-menu';

/**
 * SelectMenu for several choices at once: each click marks or unmarks an option and the menu
 * stays open. The trigger reads "Ana", "Ana y Luis" or "Ana y 2 más". With `noneLabel`, a first
 * row clears every mark ("Sin asignar"). Keyboard: arrows move, Enter marks, Escape closes; a
 * click outside closes it too.
 */
@Component({
  selector: 'app-multi-select-menu',
  imports: [Icon],
  template: `
    <button type="button" class="trigger" [class.open]="open()" [attr.aria-label]="label()" aria-haspopup="listbox" [attr.aria-expanded]="open()" (click)="toggle()">
      <span class="value" [class.placeholder]="!summary()">{{ summary() || placeholder() }}</span>
      <app-icon name="down" class="chev" />
    </button>
    @if (open()) {
      <div class="panel">
        @if (searchable()) {
          <label class="search"><app-icon name="search" />
            <input type="search" aria-label="Buscar" placeholder="Buscar…" [value]="query()" (input)="filter($event)" (keydown)="onKey($event)" />
          </label>
        }
        <ul role="listbox" aria-multiselectable="true" [attr.aria-label]="label()" tabindex="-1" (keydown)="onKey($event)">
          @if (noneLabel(); as none) {
            <li role="option" class="none-row" [attr.aria-selected]="!values().length" [class.on]="!values().length" (click)="clear()">
              <span class="box">@if (!values().length) { <app-icon name="check" [stroke]="2.6" /> }</span>
              <span class="value">{{ none }}</span>
            </li>
          }
          @for (option of shown(); track option.value; let i = $index) {
            @let on = values().includes(option.value);
            <li role="option" [attr.aria-selected]="on" [class.on]="on" [class.active]="i === active()" (mouseenter)="active.set(i)" (click)="flip(option.value)">
              <span class="box">@if (on) { <app-icon name="check" [stroke]="2.6" /> }</span>
              <span class="value">{{ option.label }}</span>
            </li>
          } @empty {
            <li class="none">Nada coincide.</li>
          }
        </ul>
      </div>
    }
  `,
  styles: [
    MENU_STYLES,
    `
    .box { width: 17px; height: 17px; flex-shrink: 0; border-radius: 5px; border: 1.5px solid var(--color-border-strong); background: var(--color-surface);
      display: flex; align-items: center; justify-content: center; color: #fff; --icon-size: 11px; }
    li.on .box { background: var(--color-primary); border-color: var(--color-primary); }
    .none-row { border-bottom: 1px solid var(--color-border-soft); border-radius: 8px 8px 0 0; margin-bottom: 4px; }
    `,
  ],
  host: { '(document:click)': 'onOutside($event)' },
})
export class MultiSelectMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input.required<MenuOption[]>();
  readonly values = input<string[]>([]);
  readonly label = input('Elegir');
  readonly placeholder = input('Elige…');
  readonly searchable = input(false);
  /** When set, a first row with this label unmarks everything ("Sin asignar"). */
  readonly noneLabel = input<string | null>(null);
  /** The whole new selection, after each mark or unmark. */
  readonly changed = output<string[]>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly shown = computed(() => {
    const needle = normalize(this.query());
    return needle ? this.options().filter((o) => normalize(o.label).includes(needle)) : this.options();
  });
  protected readonly summary = computed(() => {
    const names = this.options().filter((o) => this.values().includes(o.value)).map((o) => o.label);
    if (names.length <= 2) return names.join(' y ');
    return `${names[0]} y ${names.length - 1} más`;
  });

  protected toggle(): void {
    if (this.open()) return this.close();
    this.query.set('');
    this.active.set(0);
    this.open.set(true);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.panel input, .panel ul')?.focus());
  }

  protected filter(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected flip(value: string): void {
    const current = this.values();
    this.changed.emit(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

  protected clear(): void {
    if (this.values().length) this.changed.emit([]);
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.shown().length;
    if (event.key === 'Escape') return this.close();
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = this.shown()[this.active()];
      if (option) this.flip(option.value);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (count) this.active.update((i) => (i + (event.key === 'ArrowDown' ? 1 : -1) + count) % count);
  }

  protected onOutside(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  private close(refocus = true): void {
    this.open.set(false);
    if (refocus) this.host.nativeElement.querySelector<HTMLElement>('.trigger')?.focus();
  }
}
