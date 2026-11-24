import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SubscriptionView } from '../../shared/api/subscriptions';
import { formatUsdCents } from '../../shared/format/money';
import { dayText, subscriptionEvents } from './subscription.rules';

/**
 * «Tu suscripción en el tiempo» (mockup web-35, step 5), from the subscription's real dates: when
 * the plan was assigned, the payment due and, while it is pending, the day the account would be
 * suspended. The payments join it in stage 3.
 */
@Component({
  selector: 'app-subscription-timeline',
  template: `
    <section class="card box">
      <h3>Tu suscripción en el tiempo</h3>
      <ul class="events">
        @for (event of events(); track event.kind) {
          <li>
            <i [class]="event.kind"></i>
            <div><b>{{ date(event.on) }} · {{ event.title }}</b><small>{{ event.detail }}</small></div>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .box { padding: 16px 18px; }
    h3 { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
    .events { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    li { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; }
    li i { width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; flex: none; background: var(--color-success); }
    li i.due { background: var(--color-warning); }
    li i.suspension { background: var(--color-danger); }
    li small { display: block; font-size: 12.5px; color: var(--color-text-muted); margin-top: 1px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionTimeline {
  readonly subscription = input.required<SubscriptionView>();

  protected readonly events = computed(() => subscriptionEvents(this.subscription(), formatUsdCents));

  protected date(day: string): string {
    return dayText(day, true);
  }
}
