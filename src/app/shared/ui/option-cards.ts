import { Component, computed, input, output, signal } from '@angular/core';
import { Icon, type IconName } from './icon';

export interface OptionCard {
  value: string;
  label: string;
  icon: IconName;
  hint?: string;
}

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/**
 * One choice among a few, as cards with an icon: the chosen one has a blue border and a check.
 * With `searchable`, a box filters them as the person types; `pinned` values (like «Otro»)
 * always stay in sight. Keyboard: arrows move between cards, Enter or Space picks.
 */
@Component({
  selector: 'app-option-cards',
  imports: [Icon],
  template: `
    @if (searchable()) {
      <label class="search">
        <app-icon name="search" />
        <input type="search" [attr.aria-label]="searchLabel()" [placeholder]="searchLabel()" [value]="query()" (input)="query.set(text($event))" />
      </label>
    }
    <div class="grid" role="radiogroup" [attr.aria-label]="label()">
      @for (option of shown(); track option.value) {
        @let on = option.value === value();
        <button type="button" role="radio" class="card" [class.on]="on" [attr.aria-checked]="on" (click)="picked.emit(option.value)">
          <span class="ic"><app-icon [name]="option.icon" /></span>
          <span class="text">
            <span class="name">{{ option.label }}</span>
            @if (option.hint) { <small>{{ option.hint }}</small> }
          </span>
          @if (on) { <span class="check"><app-icon name="check" [stroke]="2.4" /></span> }
        </button>
      } @empty {
        <p class="none">Ninguno coincide. Elige «Otro» y escríbelo.</p>
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .search { display: flex; align-items: center; gap: 8px; padding: 0 12px; border: 1px solid var(--color-border-strong); border-radius: 10px;
      background: var(--color-surface); color: var(--color-text-faint); --icon-size: 17px; }
    .search:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .search input { flex: 1; border: 0; outline: 0; background: none; padding: 10px 0; font: inherit; font-size: 14px; color: var(--color-text); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
    .card { position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 14px; text-align: left; font: inherit; color: var(--color-text);
      border: 1px solid var(--color-border-strong); border-radius: 12px; background: var(--color-surface); cursor: pointer;
      transition: border-color 0.12s, box-shadow 0.12s; }
    .card:hover { border-color: var(--color-primary); }
    .card:focus-visible { outline: 0; box-shadow: 0 0 0 3px var(--color-primary-soft); border-color: var(--color-primary); }
    .card.on { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); background: var(--color-primary-softer); }
    .ic { width: 36px; height: 36px; flex-shrink: 0; border-radius: 9px; background: var(--color-surface-muted); color: var(--color-text-muted);
      display: flex; align-items: center; justify-content: center; --icon-size: 19px; }
    .card.on .ic { background: var(--color-primary); color: #fff; }
    .text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .name { font-size: 13.5px; font-weight: 600; }
    small { font-size: 12px; color: var(--color-text-muted); }
    .check { position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border-radius: 50%; background: var(--color-primary); color: #fff;
      display: flex; align-items: center; justify-content: center; --icon-size: 11px; }
    .none { grid-column: 1 / -1; font-size: 13px; color: var(--color-text-muted); }
  `,
  host: { '(keydown)': 'onKey($event)' },
})
export class OptionCards {
  readonly options = input.required<OptionCard[]>();
  readonly value = input<string | null>(null);
  readonly label = input('Opciones');
  readonly searchable = input(false);
  readonly searchLabel = input('Buscar');
  /** Always shown, even when the search does not match (for example «Otro»). */
  readonly pinned = input<string[]>([]);
  readonly picked = output<string>();

  protected readonly query = signal('');
  protected readonly shown = computed(() => {
    const needle = normalize(this.query());
    return needle ? this.options().filter((o) => this.pinned().includes(o.value) || normalize(o.label).includes(needle)) : this.options();
  });

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** Arrows move the focus between cards, as a radio group does. */
  protected onKey(event: KeyboardEvent): void {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const cards = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('.card')];
    const index = cards.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
    cards[(index + step + cards.length) % cards.length]?.focus();
  }
}
