import { Component, computed, input, output } from '@angular/core';
import { type MenuOption, SelectMenu } from './select-menu';

const pad = (n: number) => String(n).padStart(2, '0');

/** "14:30" → "2:30 p. m.", how people read hours in Venezuela. */
export function twelveHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h! < 12 ? 'a. m.' : 'p. m.';
  return `${((h! + 11) % 12) + 1}:${pad(m!)} ${suffix}`;
}

/**
 * Our own hour field, in place of <input type="time">: the hours of the day every `step` minutes
 * in the shared dropdown, with search. Works with "HH:MM" (24 h) strings.
 */
@Component({
  selector: 'app-time-select',
  imports: [SelectMenu],
  template: `<app-select-menu [options]="options()" [value]="value()" [label]="label()" [placeholder]="placeholder()" [searchable]="true" (picked)="picked.emit($event)" />`,
})
export class TimeSelect {
  readonly value = input<string | null>(null);
  readonly label = input('Hora');
  readonly placeholder = input('Elige la hora');
  /** Minutes between options. */
  readonly step = input(30);
  readonly picked = output<string>();

  protected readonly options = computed<MenuOption[]>(() => {
    const list: MenuOption[] = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += this.step()) {
      const value = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
      list.push({ value, label: twelveHour(value) });
    }
    // A saved hour off the grid ("09:10") still shows as chosen.
    const current = this.value();
    if (current && !list.some((o) => o.value === current)) list.push({ value: current, label: twelveHour(current) });
    return list.sort((a, b) => a.value.localeCompare(b.value));
  });
}
