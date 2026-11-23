import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Tone } from '../../shared/api/models';
import { formatUsdCents } from '../../shared/format/money';
import { Pill } from '../../shared/ui/pill';
import type { PaymentStatus } from './subscription.models';
import { SubscriptionData } from './subscription.data';
import { yearTotals } from './subscription.rules';

const STATUS: Record<PaymentStatus, { text: string; tone: Tone }> = {
  approved: { text: 'Aprobado', tone: 'green' },
  in_review: { text: 'En revisión', tone: 'blue' },
  rejected: { text: 'Rechazado', tone: 'red' },
};

const dayText = (day: string, year = true) =>
  new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' })
    .format(new Date(`${day}T12:00:00Z`))
    .replace('.', '');

/**
 * Suscripción → Pagos (mockup web-35, step 4): what the company paid, each payment with the period
 * it covers and its discount. On phones the table turns into a list of cards.
 */
@Component({
  selector: 'app-subscription-payments',
  imports: [Pill],
  template: `
    @let y = year();
    @let s = data.subscription();
    <div class="figures">
      <div class="card figure"><p>Pagado en {{ data.today().slice(0, 4) }}</p><b>{{ money(y.paidCents) }}</b><small>{{ y.payments }} {{ y.payments === 1 ? 'pago' : 'pagos' }}</small></div>
      <div class="card figure"><p>Ahorrado</p><b class="saved">{{ money(y.savedCents) }}</b><small>con descuentos</small></div>
      @if (since(); as first) {
        <div class="card figure"><p>Cliente desde</p><b>{{ first.text }}</b><small>{{ first.months }} {{ first.months === 1 ? 'mes' : 'meses' }} con Vortomi</small></div>
      }
    </div>

    <div class="card table-card">
      <table class="data-table">
        <thead><tr><th>Fecha</th><th>Plan y período</th><th class="num">Monto</th><th>Método</th><th>Estado</th></tr></thead>
        <tbody>
          @for (p of s.payments; track p.id) {
            <tr>
              <td data-label="Fecha">{{ date(p.paidOn) }}</td>
              <td data-label="Plan">{{ p.planName }} · {{ p.months }} {{ p.months === 1 ? 'mes' : 'meses' }}
                <small>{{ date(p.from, false) }} – {{ date(p.to) }}@if (p.discountPercent) { · −{{ p.discountPercent }} % }</small></td>
              <td class="num" data-label="Monto">{{ money(p.amountCents) }}</td>
              <td data-label="Método">{{ p.method }}@if (p.reference) { <small>Ref. {{ p.reference }}</small> }</td>
              <td data-label="Estado"><app-pill [tone]="status[p.status].tone" [dot]="true">{{ status[p.status].text }}</app-pill></td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="empty-state">Todavía no hay pagos.</td></tr>
          }
        </tbody>
      </table>
    </div>
    <p class="note">Cuando reportes tus pagos desde aquí, también verás los que están <app-pill tone="blue" [dot]="true">En revisión</app-pill> o
      <app-pill tone="red" [dot]="true">Rechazado</app-pill>, con el motivo.</p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .figures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .figure { padding: 12px 16px; display: flex; flex-direction: column; gap: 2px; }
    .figure p { font-size: 12.5px; color: var(--color-text-muted); }
    .figure b { font-size: 20px; font-weight: 700; }
    .figure b.saved { color: var(--color-success-text); }
    .figure small { font-size: 12px; color: var(--color-text-muted); }
    .table-card { overflow-x: auto; }
    td small { display: block; font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }
    .num { text-align: right; white-space: nowrap; }
    .note { font-size: 13px; color: var(--color-text-muted); line-height: 1.7; }
    /* Phones: each payment is a card, its data one under the other. */
    @media (max-width: 760px) {
      .figures { grid-template-columns: 1fr; }
      .table-card { background: none; border: 0; box-shadow: none; }
      thead { display: none; }
      table, tbody, tr, td { display: block; width: 100%; }
      tr { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 10px 14px; margin-bottom: 10px; }
      .table-card .data-table td { border: 0; padding: 3px 0; text-align: left; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionPayments {
  protected readonly data = inject(SubscriptionData);
  protected readonly status = STATUS;

  protected readonly year = computed(() => yearTotals(this.data.subscription().payments, this.data.today().slice(0, 4)));

  /** The oldest payment: a client since then. */
  protected readonly since = computed(() => {
    const payments = this.data.subscription().payments;
    const first = payments[payments.length - 1];
    if (!first) return null;
    const [y1, m1] = [Number(first.from.slice(0, 4)), Number(first.from.slice(5, 7))];
    const today = this.data.today();
    const months = (Number(today.slice(0, 4)) - y1) * 12 + Number(today.slice(5, 7)) - m1;
    return { text: dayText(first.from), months: Math.max(1, months) };
  });

  protected date(day: string, year = true): string {
    return dayText(day, year);
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }
}
