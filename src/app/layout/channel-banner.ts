import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Session } from '../core/session';
import { Workspace } from '../core/workspace';
import { Icon } from '../shared/ui/icon';
import { channelNotices } from './channel-notices';

/** Fixed warning above every panel screen while one of the company's numbers is not working. */
@Component({
  selector: 'app-channel-banner',
  imports: [Icon],
  template: `
    @for (notice of notices(); track notice.channelId) {
      <div class="notice" role="alert">
        <app-icon name="alert" />
        <p><b>{{ notice.title }}</b> {{ notice.detail }}</p>
      </div>
    }
  `,
  styles: `
    :host { display: block; flex-shrink: 0; }
    .notice { display: flex; gap: 10px; align-items: flex-start; padding: 10px 26px; background: #fdf1ef;
      border-bottom: 1px solid #f3b9b1; color: #8a1d14; font-size: 13px; line-height: 1.45; --icon-size: 17px; }
    .notice app-icon { margin-top: 1px; flex-shrink: 0; }
    @media (max-width: 760px) { .notice { padding: 10px 16px; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelBanner {
  private readonly workspace = inject(Workspace);
  private readonly session = inject(Session);

  protected readonly notices = computed(() => channelNotices(this.workspace.channels(), this.session.isTenantAdmin()));
}
