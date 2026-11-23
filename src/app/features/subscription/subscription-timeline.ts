import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { SubscriptionEvent } from './subscription.models';
import { SubscriptionData } from './subscription.data';
import { timeline } from './subscription.rules';

/**
 * «Tu suscripción en el tiempo» (mockup web-35, step 5): every period paid as a bar along the
 * months, today marked, and the events: next payment, price changes coming, payments, plan changes.
 */
@Component({
  selector: 'app-subscription-timeline',
  template: `
    @let t = line();
    <section class="card box">
      <h3>Tu suscripción en el tiempo</h3>
      <div class="months" [style.grid-template-columns]="'repeat(' + t.months.length + ', minmax(0, 1fr))'">
        @for (month of t.months; track $index) { <span>{{ month }}</span> }
      </div>
      <div class="track">
        @for (bar of t.bars; track $index) {
          <span class="bar" [class.current]="bar.current" [class.other]="bar.plan !== data.subscription().planName" [style.left.%]="bar.left" [style.width.%]="bar.width">{{ bar.label }}</span>
        }
        <span class="today" [style.left.%]="t.todayAt"><span>Hoy</span></span>
      </div>
      <ul class="events">
        @for (event of data.subscription().events; track event.on + event.kind) {
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
    .months { display: grid; font-size: 12px; color: var(--color-text-muted); text-align: center; text-transform: capitalize; }
    .track { position: relative; height: 32px; margin-top: 6px; border-radius: var(--radius-md); background: var(--color-surface-hover); }
    .bar { position: absolute; top: 4px; bottom: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; white-space: nowrap;
      border-radius: 6px; font-size: 11.5px; font-weight: 600; color: var(--color-on-primary); background: var(--primary-400); }
    .bar.current { background: var(--primary-700); }
    /* A period of another plan (before a change). */
    .bar.other { background: var(--color-text-faint); }
    .today { position: absolute; top: -6px; bottom: -6px; width: 2px; background: var(--color-danger); }
    .today span { position: absolute; bottom: -18px; left: -10px; font-size: 11px; font-weight: 700; color: var(--color-danger); white-space: nowrap; }
    .events { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-top: 28px; }
    li { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; }
    li i { width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; flex: none; background: var(--color-success); }
    li i.next_payment { background: var(--color-warning); }
    li i.price_change { background: var(--color-primary); }
    li small { display: block; font-size: 12.5px; color: var(--color-text-muted); margin-top: 1px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionTimeline {
  protected readonly data = inject(SubscriptionData);

  protected readonly line = computed(() => {
    const s = this.data.subscription();
    return timeline(s.payments, s.endsOn, this.data.today());
  });

  protected date(day: SubscriptionEvent['on']): string {
    return new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${day}T12:00:00Z`))
      .replace('.', '');
  }
}
