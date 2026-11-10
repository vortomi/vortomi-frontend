import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Tone } from '../api/models';

/** Status badge (Flowbite style: soft background, 6px corners, a dot in the text colour). */
@Component({
  selector: 'app-pill',
  template: '@if (dot()) { <i class="dot"></i> }<ng-content />',
  host: { '[class]': 'tone()' },
  styles: `
    :host { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; line-height: 20px;
      padding: 1px 10px; border-radius: 6px; white-space: nowrap; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
    :host(.green) { background: var(--color-success-soft); color: var(--color-success-text); }
    :host(.red) { background: var(--color-danger-soft); color: var(--color-danger-text); }
    :host(.amber) { background: var(--color-warning-soft); color: var(--color-warning-text); }
    :host(.blue) { background: var(--color-info-soft); color: var(--color-info-text); }
    :host(.violet) { background: var(--color-violet-soft); color: var(--color-violet-text); }
    :host(.neutral) { background: var(--color-surface-hover); color: var(--color-text-2); }
    :host(.pink) { background: var(--color-pink-soft); color: var(--color-pink-text); }
    :host(.teal) { background: var(--color-teal-soft); color: var(--color-teal-text); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pill {
  readonly tone = input<Tone>('neutral');
  /** A dot in the text colour before the text: statuses (orders, conversations). */
  readonly dot = input(false);
}
