import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Day, SubscriptionView } from '../../shared/api/subscriptions';
import { Icon } from '../../shared/ui/icon';
import { SubscriptionPay } from './subscription-pay';
import { addDays, dayText } from './subscription.rules';

/**
 * Suscripción → Resumen of a company Vortomi exempted from paying (mockup web-49, frame 5): until
 * when, and what comes after; no countdown, nothing to pay. The reason is Vortomi's: never shown.
 * A plan chosen meanwhile shows what it includes, and its first payment can be made ahead.
 */
@Component({
  selector: 'app-subscription-exempt',
  imports: [Icon, SubscriptionPay],
  template: `
    <div class="hero">
      <section class="exempt">
        <span class="tag">Tu cuenta</span>
        <h2>Exonerada del pago</h2>
        @if (endsOn(); as day) {
          <p>Vortomi te exoneró de la mensualidad <b>hasta el {{ date(day) }}</b>. Mientras tanto usas Vortomi completo, sin pagar.</p>
        } @else {
          <p>Vortomi te exoneró de la mensualidad. Usas Vortomi completo, sin pagar.</p>
        }
      </section>
      <section class="after">
        @if (endsOn(); as day) {
          <span class="lbl">Después del {{ date(day, false) }}</span>
          @if (subscription(); as s) {
            <b>Pagas tu plan {{ s.plan.name }}</b>
            <span class="muted">Tu primer pago vence el {{ date(nextDay()!) }}. Te avisamos 7 días antes.</span>
          } @else {
            <b>Eliges tu plan</b>
            <span class="muted">Te avisamos 7 días antes. Ya puedes ver los planes y elegir el tuyo.</span>
            <button type="button" class="btn btn--sm" (click)="plans.emit()">Ver los planes</button>
          }
        } @else {
          <span class="lbl">Sin fecha de fin</span>
          <b>No tienes nada que pagar</b>
          <span class="muted">Si esto cambia, te avisamos con 7 días.</span>
        }
      </section>
    </div>

    @if (subscription(); as s) {
      @if (s.charge) { <app-subscription-pay [subscription]="s" /> }
      <section class="benefits">
        <h3>Lo que incluye tu plan {{ s.plan.name }}</h3>
        <div class="meters">
          @for (benefit of s.plan.benefits; track $index) {
            <div class="meter"><app-icon name="check" />{{ benefit }}</div>
          }
        </div>
      </section>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 16px; }
    /* Dark teal in both themes: white text keeps AA contrast on all of it. */
    .exempt { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; border-radius: var(--radius-lg); color: #fff;
      background: linear-gradient(135deg, #155e75, #0e7490); }
    .tag { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
    h2 { font-size: 26px; font-weight: 700; }
    .exempt p { font-size: 14px; line-height: 1.5; opacity: 0.95; }
    .after { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 16px 18px; border-radius: var(--radius-lg);
      background: var(--color-surface); border: 1px solid var(--color-border); }
    .after .lbl { font-size: 13px; color: var(--color-text-muted); }
    .after b { font-size: 18px; }
    .after .muted { font-size: 13.5px; color: var(--color-text-muted); line-height: 1.45; }
    .after .btn { margin-top: 4px; }
    h3 { font-size: 15px; font-weight: 600; margin-bottom: 10px; }
    .meters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .meter { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-surface); font-size: 13.5px; color: var(--color-text-2); --icon-size: 16px; }
    .meter app-icon { color: var(--color-success); }
    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; }
      .meters { grid-template-columns: 1fr; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionExempt {
  /** The last exempt day; null with no end. */
  readonly endsOn = input.required<Day | null>();
  /** A plan chosen while exempt, if any. */
  readonly subscription = input<SubscriptionView | null>(null);
  /** «Ver los planes». */
  readonly plans = output<void>();

  protected readonly nextDay = computed(() => {
    const day = this.endsOn();
    return day ? addDays(day, 1) : null;
  });

  protected date(day: Day, year = true): string {
    return dayText(day, year);
  }
}
