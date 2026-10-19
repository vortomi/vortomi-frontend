import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Tone } from '../api/models';

@Component({
  selector: 'app-pill',
  template: '<ng-content />',
  host: { '[class]': 'tone()' },
  styles: `
    :host { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500;
      padding: 3px 9px; border-radius: var(--radius-pill); white-space: nowrap; }
    :host(.green) { background: #e3f6ea; color: #166534; }
    :host(.red) { background: #fde8e6; color: #a8231a; }
    :host(.amber) { background: #fdf0d8; color: #92500a; }
    :host(.blue) { background: #e6eafd; color: #2b3fc4; }
    :host(.violet) { background: #efe9fd; color: #5b3fb5; }
    :host(.neutral) { background: #eef0f3; color: #4b5565; }
    :host(.pink) { background: #fde7f1; color: #a3195b; }
    :host(.teal) { background: #dff5f1; color: #0f6e5c; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pill {
  readonly tone = input<Tone>('neutral');
}
