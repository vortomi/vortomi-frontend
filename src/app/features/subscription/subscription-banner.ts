import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { readStored, writeStored } from '../../core/storage';
import { Icon } from '../../shared/ui/icon';
import { SubscriptionData } from './subscription.data';
import { reminderText } from './subscription.rules';

/** The day the banner was closed: it comes back the next day. */
const DISMISSED_KEY = 'vortomi-subscription-banner';

/**
 * Above every panel screen (mockup web-35, step 2): amber from 7 days before the plan is due, red
 * once it is due. Only for the company's admins, and only with real data or in the preview.
 */
@Component({
  selector: 'app-subscription-banner',
  imports: [Icon, RouterLink],
  template: `
    @if (shown(); as r) {
      <div class="notice" [class.overdue]="r.level === 'overdue'" role="status">
        <app-icon [name]="r.level === 'overdue' ? 'alert' : 'clock'" />
        <p>
          <b>{{ r.level === 'overdue' ? 'Tu plan ' + data.subscription().planName + ' ' + text(r).toLowerCase() + '.' : 'Tu plan ' + data.subscription().planName + ' ' + text(r).toLowerCase() + ' (' + dueDay() + ').' }}</b>
          {{ r.level === 'overdue' ? 'Paga para que el bot siga respondiendo. Tus datos no se borran.' : 'Paga a tiempo para que el bot siga respondiendo.' }}
        </p>
        <a class="btn btn--sm" routerLink="/subscription">Ver suscripción</a>
        <button type="button" class="icon-btn" aria-label="Cerrar el aviso hasta mañana" (click)="dismiss()"><app-icon name="x" /></button>
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
    if (!this.data.badge()) return null;
    if (this.dismissedOn() === this.data.today()) return null;
    return this.data.reminder();
  });

  protected readonly dueDay = computed(() =>
    new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', timeZone: 'America/Caracas' }).format(this.data.due()).replace('.', ''),
  );

  protected text = reminderText;

  protected dismiss(): void {
    writeStored(DISMISSED_KEY, this.data.today());
    this.dismissedOn.set(this.data.today());
  }
}
