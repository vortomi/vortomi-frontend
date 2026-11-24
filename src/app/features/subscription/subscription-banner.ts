import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { readStored, writeStored } from '../../core/storage';
import { Icon } from '../../shared/ui/icon';
import { SubscriptionData } from './subscription.data';

/** The day the banner was closed: it comes back the next day. */
const DISMISSED_KEY = 'vortomi-subscription-banner';

/**
 * Above every panel screen (mockup web-37, frames 5 and 6): amber while the first payment is
 * pending or the plan is about to be due, red once it is overdue. Only for the company's admins
 * (only they read the subscription). A company locked out cannot close it.
 */
@Component({
  selector: 'app-subscription-banner',
  imports: [Icon, RouterLink],
  template: `
    @if (shown(); as n) {
      <div class="notice" [class.overdue]="n.tone === 'overdue'" role="status">
        <app-icon [name]="n.tone === 'overdue' ? 'alert' : 'clock'" />
        <p><b>{{ n.title }}</b> {{ n.detail }}</p>
        <a class="btn btn--sm" routerLink="/subscription">Ir a Suscripción</a>
        @if (n.dismissable) {
          <button type="button" class="icon-btn" aria-label="Cerrar el aviso hasta mañana" (click)="dismiss()"><app-icon name="x" /></button>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; flex-shrink: 0; }
    .notice { display: flex; gap: 10px; align-items: center; padding: 9px 26px; font-size: 13px; line-height: 1.45; --icon-size: 17px;
      background: var(--color-warning-soft); color: var(--color-warning-text); border-bottom: 1px solid color-mix(in srgb, var(--color-warning) 45%, transparent); }
    .notice.overdue { background: var(--color-danger-soft); color: var(--color-danger-text); border-bottom-color: color-mix(in srgb, var(--color-danger) 40%, transparent); }
    p { flex: 1; min-width: 0; }
    .btn { flex: none; }
    .icon-btn { color: inherit; }
    @media (max-width: 760px) { .notice { padding: 9px 16px; flex-wrap: wrap; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionBanner {
  protected readonly data = inject(SubscriptionData);
  private readonly dismissedOn = signal(readStored<string>(DISMISSED_KEY));

  protected readonly shown = computed(() => {
    const notice = this.data.notice();
    if (!notice) return null;
    if (notice.dismissable && this.dismissedOn() === this.data.today()) return null;
    return notice;
  });

  protected dismiss(): void {
    writeStored(DISMISSED_KEY, this.data.today());
    this.dismissedOn.set(this.data.today());
  }
}
