import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import type { SubscriptionPayment, SubscriptionView } from '../../shared/api/subscriptions';
import { formatAmount, formatUsdCents } from '../../shared/format/money';
import { FileViewerDialog } from '../../shared/ui/file-viewer.dialog';
import { Icon } from '../../shared/ui/icon';
import { SubscriptionPayments } from './subscription-payments.data';
import { SubscriptionCountdown } from './subscription-countdown';
import { SubscriptionPay } from './subscription-pay';
import { SubscriptionTimeline } from './subscription-timeline';
import { SubscriptionData } from './subscription.data';
import { STATE_TEXT, STATE_TONE, dayText } from './subscription.rules';

/**
 * Suscripción → Resumen (mockups web-35 and web-37, frame 5): the plan and its state, the
 * countdown (to the suspension while a payment is pending), what to pay now, what the plan
 * includes and the subscription's dates.
 */
@Component({
  selector: 'app-subscription-summary',
  imports: [FileViewerDialog, Icon, SubscriptionCountdown, SubscriptionPay, SubscriptionTimeline],
  template: `
    @let s = subscription();
    @let tone = toneOf[s.state];
    <div class="hero">
      <section class="plan">
        <span class="tag">Tu plan</span>
        <h2>{{ s.plan.name }} <span class="state" [class]="tone">● {{ stateText[s.state] }}</span></h2>
        <p class="price"><b>{{ money(s.plan.priceCents) }}</b> al mes</p>
        @if (s.billingDay === null) {
          <p class="line">Tu día de cobro será el día de tu primer pago.</p>
        } @else {
          <p class="line">Tu día de cobro: los {{ s.billingDay }} de cada mes · vence el {{ date(s.nextDueOn) }}</p>
        }
      </section>
      @if (s.state === 'in_review') {
        <section class="held" aria-label="Tu pago está en revisión">
          <span class="lbl">Tu pago está en revisión</span>
          <ol class="steps">
            <li class="done"><app-icon name="check" /><span>Enviado</span></li>
            <li class="now"><app-icon name="clock" /><span>En revisión</span></li>
            <li><app-icon name="check" /><span>Aprobado</span></li>
          </ol>
          <p class="next">Tu cuenta <b>no se suspende</b> mientras lo revisamos: cubre todo lo que debes.</p>
        </section>
      } @else if (data.target(); as target) {
        <app-subscription-countdown [now]="data.now()" [due]="target.at" [suspension]="target.suspension" [level]="target.suspension ? 'overdue' : tone" [monthlyCents]="s.plan.priceCents" />
      }
    </div>

    @if (s.inReview; as p) {
      <section class="received"><app-icon name="clock" />
        <div><b>Recibimos tu pago: {{ paidText(p) }} por {{ p.methodName }}</b>
          <span>@if (p.reference) { Referencia {{ p.reference }} · }{{ date(p.paidOn) }}. Lo revisamos y te avisamos aquí. Mientras esté en revisión no puedes enviar otro ni cambiarlo.</span></div>
        @if (p.hasProof) { <button type="button" class="btn btn--sm view" (click)="viewing.set(true)">Ver comprobante</button> }
      </section>
      @if (viewing()) {
        <app-file-viewer-dialog [open]="true" [title]="'Comprobante · ' + p.methodName + (p.reference ? ' ' + p.reference : '')" [load]="proofOf(p.id)"
          [fileName]="'comprobante-' + (p.reference ?? p.id)" (closed)="viewing.set(false)" />
      }
    }

    <app-subscription-pay [subscription]="s" />

    <section class="benefits">
      <h3>Lo que incluye tu plan</h3>
      <div class="meters">
        @for (benefit of s.plan.benefits; track $index) {
          <div class="meter included"><app-icon name="check" />{{ benefit }}</div>
        }
      </div>
    </section>

    <app-subscription-timeline [subscription]="s" />
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 16px; }
    .plan { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; border-radius: var(--radius-lg); color: var(--color-on-primary);
      background: linear-gradient(135deg, var(--primary-700), var(--primary-500)); }
    .tag { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
    h2 { font-size: 26px; font-weight: 700; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .state { font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 99px; background: color-mix(in srgb, var(--color-on-primary) 20%, transparent); }
    .state.soon { background: var(--color-warning-soft); color: var(--color-warning-text); }
    .state.overdue { background: var(--color-danger-soft); color: var(--color-danger-text); }
    .state.review { background: var(--color-info-soft); color: var(--color-info-text); }
    /* Same shape as the countdown: a label, three tiles, a line under them. */
    .held { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border-radius: var(--radius-lg); background: var(--color-surface);
      border: 1px solid color-mix(in srgb, var(--color-info-text) 30%, transparent); }
    .held .lbl { font-size: 13px; color: var(--color-info-text); font-weight: 600; }
    .steps { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .steps li { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; border-radius: var(--radius-md); font-size: 12px;
      background: var(--color-surface-hover); color: var(--color-text-faint); --icon-size: 20px; }
    .steps li.done { background: var(--color-success-soft); color: var(--color-success-text); }
    .steps li.now { background: var(--color-info-soft); color: var(--color-info-text); font-weight: 600; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-info-text) 35%, transparent); }
    .next { font-size: 13.5px; color: var(--color-text-2); }
    .received { display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; border-radius: var(--radius-lg); font-size: 13px; line-height: 1.45;
      background: var(--color-info-soft); color: var(--color-info-text); --icon-size: 20px; }
    .received b { display: block; font-size: 14px; }
    .received span { color: var(--color-text-2); }
    .received > div { flex: 1; }
    .received .view { flex: none; align-self: center; }
    .price { font-size: 14px; }
    .price b { font-size: 20px; }
    .line { font-size: 13px; opacity: 0.92; }
    h3 { font-size: 15px; font-weight: 600; margin-bottom: 10px; }
    .meters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .meter { padding: 10px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); font-size: 13.5px; }
    .included { display: flex; align-items: center; gap: 8px; color: var(--color-text-2); --icon-size: 16px; }
    .included app-icon { color: var(--color-success); }
    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; }
      .meters { grid-template-columns: 1fr; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionSummary {
  readonly subscription = input.required<SubscriptionView>();
  protected readonly data = inject(SubscriptionData);
  private readonly payments = inject(SubscriptionPayments);
  /** «Ver comprobante» of the payment in review is open. */
  protected readonly viewing = signal(false);

  protected proofOf(paymentId: string): () => Promise<Blob> {
    return () => this.payments.proof(paymentId);
  }
  protected readonly stateText = STATE_TEXT;
  protected readonly toneOf = STATE_TONE;

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected date(day: string): string {
    return dayText(day, true);
  }

  /** «92.435,33 Bs», «225,15 $»: in the method's currency. */
  protected paidText(p: SubscriptionPayment): string {
    return formatAmount(Number(p.amount), p.currency);
  }
}
