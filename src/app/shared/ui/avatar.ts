import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Colours are derived from the id, so they are stable and never stored in the database.
const PALETTE = ['#3b4fd8', '#10a37f', '#c2410c', '#6d4dc4', '#0f766e', '#b45309', '#be185d', '#2563eb', '#7c3aed', '#a16207'];

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '?';
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : (words[0]?.[1] ?? '');
  return (first + second).toUpperCase();
}

export function colorFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0]!;
}

@Component({
  selector: 'app-avatar',
  template: '{{ initials() }}',
  host: {
    '[style.background]': 'color()',
    '[class]': 'size()',
    '[attr.title]': 'name()',
  },
  styles: `
    :host { width: 32px; height: 32px; border-radius: 50%; color: #fff; font-size: 12px; font-weight: 600;
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    :host(.sm) { width: 24px; height: 24px; font-size: 10px; }
    :host(.md) { width: 38px; height: 38px; font-size: 13px; }
    :host(.lg) { width: 64px; height: 64px; font-size: 22px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly name = input.required<string>();
  /** Stable seed for the colour; defaults to the name. */
  readonly seed = input<string>();
  readonly size = input<'sm' | 'base' | 'md' | 'lg'>('base');

  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly color = computed(() => colorFor(this.seed() ?? this.name()));
}
