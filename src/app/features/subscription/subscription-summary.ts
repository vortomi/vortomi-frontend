import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { formatCount, formatUsdCents } from '../../shared/format/money';
import { Icon } from '../../shared/ui/icon';
import type { UsageMeter } from './subscription.models';
import { SubscriptionCountdown } from './subscription-countdown';
import { SubscriptionData } from './subscription.data';
import { type ReminderLevel, periodProgress, yearTotals } from './subscription.rules';
import { SubscriptionTimeline } from './subscription-timeline';

const shortDate = (day: string, year = true): string =>
  new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' })
    .format(new Date(`${day}T12:00:00Z`))
    .replace('.', '');

/**
 * Suscripción → Resumen (mockup web-35, steps 1 and 5): the plan with its period, the countdown,
 * three figures, every benefit with its meter, and the timeline under them.
 */
@Component({
  selector: 'app-subscription-summary',
  imports: [Icon, SubscriptionCountdown, SubscriptionTimeline],
  template: `
    @let s = data.subscription();
    @let p = progress();
    <div class="hero">
      <section class="plan">
        <span class="tag">Tu plan</span>
        <h2>{{ s.planName }} <span class="state" [class]="data.reminder().level">● {{ stateText[data.reminder().level] }}</span></h2>
        <p class="price"><b>{{ money(s.amountCents) }}</b> por {{ s.months }} {{ s.months === 1 ? 'mes' : 'meses' }}@if (s.discountPercent) { · {{ s.discountPercent }} % de descuento }</p>
        <div class="dates"><span>Desde {{ date(s.startsOn) }}</span><span>Hasta {{ date(s.endsOn) }}</span></div>
        <div class="bar" role="progressbar" [attr.aria-valuenow]="p.percent" aria-valuemin="0" aria-valuemax="100" aria-label="Período pagado"><i [style.width.%]="p.percent"></i></div>
        <div class="dates"><span>Llevas {{ p.elapsed }} de {{ p.total }} días</span><span>{{ p.percent }} %</span></div>
      </section>
      <app-subscription-countdown [now]="data.now()" [due]="data.due()" [level]="data.reminder().level" [monthlyCents]="s.monthlyBaseCents" />
    </div>

    @let y = year();
    <div class="figures">
      <div class="card figure"><p>Pagado en {{ data.today().slice(0, 4) }}</p><b>{{ money(y.paidCents) }}</b><small>{{ y.payments }} {{ y.payments === 1 ? 'pago' : 'pagos' }}</small></div>
      <div class="card figure"><p>Ahorrado con descuentos</p><b class="saved">{{ money(y.savedCents) }}</b><small>por pagar varios meses</small></div>
      @if (s.payments[0]; as last) {
        <div class="card figure"><p>Último pago</p><b>{{ date(last.paidOn, false) }}</b><small>{{ last.method }} · {{ last.status === 'approved' ? 'aprobado' : last.status === 'in_review' ? 'en revisión' : 'rechazado' }}</small></div>
      }
    </div>

    <section class="benefits">
      <h3>Lo que incluye tu plan <small>y cuánto usas</small></h3>
      <div class="meters">
        @for (meter of s.benefits; track meter.label) {
          @if (meter.limit === null) {
            <div class="meter included"><app-icon name="check" />{{ meter.label }}</div>
          } @else {
            <div class="meter">
              <div class="top"><span>{{ meter.label }}</span><b>{{ count(meter.used) }} de {{ count(meter.limit) }}</b></div>
              <div class="track"><i [class.high]="high(meter)" [style.width.%]="share(meter)"></i></div>
              @if (meter.hint) { <small>{{ meter.hint }}</small> }
            </div>
          }
        }
      </div>
    </section>

    <app-subscription-timeline />
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 16px; }
    .plan { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; border-radius: var(--radius-lg); color: var(--color-on-primary);
      background: linear-gradient(135deg, var(--primary-700), var(--primary-500)); }
    .tag { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
    h2 { font-size: 26px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
    .state { font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 99px; background: color-mix(in srgb, var(--color-on-primary) 20%, transparent); }
    .state.soon { background: var(--color-warning-soft); color: var(--color-warning-text); }
    .state.overdue { background: var(--color-danger-soft); color: var(--color-danger-text); }
    .price { font-size: 14px; }
    .price b { font-size: 20px; }
    .dates { display: flex; justify-content: space-between; font-size: 12.5px; opacity: 0.9; }
    .bar { height: 8px; border-radius: 99px; background: color-mix(in srgb, var(--color-on-primary) 25%, transparent); overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: 99px; background: var(--color-on-primary); }
    .figures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .figure { padding: 12px 16px; display: flex; flex-direction: column; gap: 2px; }
    .figure p { font-size: 12.5px; color: var(--color-text-muted); }
    .figure b { font-size: 20px; font-weight: 700; }
    .figure b.saved { color: var(--color-success-text); }
    .figure small { font-size: 12px; color: var(--color-text-muted); }
    h3 { font-size: 15px; font-weight: 600; margin-bottom: 10px; }
    h3 small { font-size: 12.5px; font-weight: 400; color: var(--color-text-muted); margin-left: 4px; }
    .meters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .meter { padding: 10px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); font-size: 13.5px; }
    .meter .top { display: flex; justify-content: space-between; gap: 10px; }
    .track { height: 6px; border-radius: 99px; background: var(--color-surface-hover); margin-top: 8px; overflow: hidden; }
    .track i { display: block; height: 100%; border-radius: 99px; background: var(--color-primary); }
    .track i.high { background: var(--color-warning); }
    .meter small { display: block; margin-top: 5px; font-size: 12px; color: var(--color-text-muted); }
    .included { display: flex; align-items: center; gap: 8px; color: var(--color-text-2); --icon-size: 16px; }
    .included app-icon { color: var(--color-success); }
    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; }
      .figures { grid-template-columns: 1fr; }
      .meters { grid-template-columns: 1fr; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionSummary {
  protected readonly data = inject(SubscriptionData);
  protected readonly stateText: Record<ReminderLevel, string> = { ok: 'Activa', soon: 'Por vencer', overdue: 'Vencida' };

  protected readonly progress = computed(() => {
    const s = this.data.subscription();
    return periodProgress(s.startsOn, s.endsOn, this.data.today());
  });
  protected readonly year = computed(() => yearTotals(this.data.subscription().payments, this.data.today().slice(0, 4)));

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected count(value: number): string {
    return formatCount(value);
  }

  protected date(day: string, year = true): string {
    return shortDate(day, year);
  }

  protected share(meter: UsageMeter): number {
    return meter.limit ? Math.min(100, Math.round((meter.used / meter.limit) * 100)) : 0;
  }

  /** 80 % or more of a limit turns the meter amber. */
  protected high(meter: UsageMeter): boolean {
    return this.share(meter) >= 80;
  }
}
