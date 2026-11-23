import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatUsdCents } from '../../shared/format/money';
import { type ReminderLevel, countdown } from './subscription.rules';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * «Tu próximo pago en 27 días 14 horas 32 min» (mockup web-35): amber within the last 7 days,
 * red once the plan is due («Tu plan venció hace…»).
 */
@Component({
  selector: 'app-subscription-countdown',
  template: `
    <span class="lbl">{{ parts().past ? 'Tu plan venció hace' : 'Tu próximo pago en' }}</span>
    <div class="digits" role="timer" [attr.aria-label]="aria()">
      <div><b>{{ pad(parts().days) }}</b><span>{{ parts().days === 1 ? 'día' : 'días' }}</span></div>
      <div><b>{{ pad(parts().hours) }}</b><span>{{ parts().hours === 1 ? 'hora' : 'horas' }}</span></div>
      <div><b>{{ pad(parts().minutes) }}</b><span>min</span></div>
    </div>
    <p class="next">El <b>{{ dueText() }}</b>@if (monthlyCents(); as cents) { · desde <b>{{ money(cents) }}</b> al mes }</p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); }
    :host(.soon) { background: var(--color-warning-soft); border-color: color-mix(in srgb, var(--color-warning) 45%, transparent); }
    :host(.overdue) { background: var(--color-danger-soft); border-color: color-mix(in srgb, var(--color-danger) 40%, transparent); }
    .lbl { font-size: 13px; color: var(--color-text-muted); }
    .digits { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .digits div { background: var(--color-surface-hover); border-radius: var(--radius-md); text-align: center; padding: 8px 0; }
    :host(.soon) .digits div { background: color-mix(in srgb, var(--color-warning) 28%, var(--color-surface)); color: var(--color-warning-text); }
    :host(.overdue) .digits div { background: color-mix(in srgb, var(--color-danger) 18%, var(--color-surface)); color: var(--color-danger-text); }
    b { font-variant-numeric: tabular-nums; }
    .digits b { display: block; font-size: 28px; line-height: 1.15; font-weight: 700; }
    .digits span { font-size: 12px; color: var(--color-text-muted); }
    :host(.soon) .digits span, :host(.overdue) .digits span { color: inherit; opacity: 0.8; }
    .next { font-size: 13.5px; color: var(--color-text-2); }
  `,
  host: { '[class.soon]': "level() === 'soon'", '[class.overdue]': "level() === 'overdue'" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionCountdown {
  readonly now = input.required<Date>();
  readonly due = input.required<Date>();
  readonly level = input<ReminderLevel>('ok');
  /** «desde 79,00 $ al mes» after the date; left out when null. */
  readonly monthlyCents = input<number | null>(null);

  protected readonly parts = computed(() => countdown(this.now(), this.due()));
  protected readonly dueText = computed(() =>
    new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Caracas' }).format(this.due()).replace('.', ''),
  );
  protected readonly aria = computed(() => {
    const p = this.parts();
    return `${p.past ? 'Venció hace' : 'Faltan'} ${p.days} días, ${p.hours} horas y ${p.minutes} minutos`;
  });

  protected pad(n: number): string {
    return pad(n);
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }
}
