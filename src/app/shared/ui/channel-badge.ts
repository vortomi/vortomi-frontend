import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ChannelAccount } from '../api/models';
import { Pill } from './pill';

/** Tells which business number a conversation came through ("Ventas", "Taller"). */
@Component({
  selector: 'app-channel-badge',
  imports: [Pill],
  template: `
    <app-pill tone="neutral">
      <i class="dot" [style.background]="channel().color"></i>{{ channel().label }}
    </app-pill>
  `,
  styles: `
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 1px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelBadge {
  readonly channel = input.required<ChannelAccount>();
}
