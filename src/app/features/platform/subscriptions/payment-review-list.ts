import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Tone } from '../../../shared/api/models';
import type { Coverage, ReviewRow } from '../../../shared/api/subscriptions';
import { formatAmount, formatUsdCents } from '../../../shared/format/money';
import { receiptCode } from '../../../shared/format/receipt-code';
import { Avatar } from '../../../shared/ui/avatar';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';
import { Skeleton } from '../../../shared/ui/skeleton';
import { dayText } from './billing.rules';
import { PlatformPaymentReview, type ReviewFilter } from './platform-payment-review';

const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: 'in_review', label: 'Por revisar' },
  { id: 'approved', label: 'Aprobados' },
  { id: 'rejected', label: 'Rechazados' },
  { id: 'all', label: 'Todos' },
];

const STATUS: Record<ReviewRow['status'], { text: string; tone: Tone }> = {
  in_review: { text: 'En revisión', tone: 'blue' },
  approved: { text: 'Aprobado', tone: 'green' },
  rejected: { text: 'Rechazado', tone: 'red' },
};

/**
 * Suscripciones → Pagos (mockup web-41, frame 1): the payments companies report. Those to review
 * first, oldest first, each with how it compares with what its company owes now. A row opens it.
 */
@Component({
  selector: 'app-payment-review-list',
  imports: [Avatar, Icon, Pill, Skeleton],
  template: `
    <div class="segmented" role="tablist" aria-label="Filtrar pagos">
      @for (option of filters; track option.id) {
        <button type="button" role="tab" [class.on]="filter() === option.id" [attr.aria-selected]="filter() === option.id" (click)="show(option.id)">
          {{ option.label }}@if (option.id === 'in_review' && review.pending()) { · {{ review.pending() }} }
        </button>
      }
    </div>
    @if (failed()) {
      <div class="form-alert" role="alert"><app-icon name="alert" /><span class="grow">No pudimos cargar los pagos.</span>
        <button type="button" class="btn btn--sm" (click)="load()"><span>Reintentar</span></button></div>
    } @else if (!loaded()) {
      <app-skeleton kind="table" [rows]="3" />
    } @else {
      <div class="card table-card">
        <table class="data-table">
          <thead><tr><th>Empresa</th><th>Fecha</th><th>Método</th><th class="num">Monto</th><th>{{ filter() === 'in_review' ? 'Frente a lo que debe' : 'Estado' }}</th></tr></thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr class="clickable" tabindex="0" (click)="open(row)" (keydown.enter)="open(row)">
                <td><div class="company"><app-avatar class="logo" [name]="row.tenantName" [seed]="row.tenantId" />
                  <div><p>{{ row.tenantName }}</p><span>{{ row.planName ?? '—' }} · {{ row.months }} {{ row.months === 1 ? 'mes' : 'meses' }}</span></div></div></td>
                <td>{{ date(row.paidOn) }}<small>enviado {{ date(row.submittedAt.slice(0, 10)) }}</small></td>
                <td>{{ row.methodName }}@if (row.reference) { <small>Ref. {{ row.reference }}</small> }</td>
                <td class="num">{{ amount(row) }}@if (row.currency === 'VES') { <small>{{ usd(row.amountUsdCents) }}</small> }</td>
                <td>
                  @if (row.status === 'in_review') {
                    <app-pill [tone]="coverage(row).tone" [dot]="true">{{ coverage(row).text }}</app-pill>
                  } @else {
                    <app-pill [tone]="status[row.status].tone" [dot]="true">{{ status[row.status].text }}</app-pill>
                    @if (row.receiptNumber) { <small>Recibo {{ receiptCode(row.receiptNumber) }}</small> }
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty-state">{{ filter() === 'in_review' ? 'No hay pagos por revisar.' : 'Ningún pago con este filtro.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      @if (filter() === 'in_review' && rows().length) { <p class="note"><app-icon name="info" />Los más antiguos primero. Al pulsar una fila se abre el pago.</p> }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .segmented { align-self: flex-start; max-width: 100%; overflow-x: auto; }
    .grow { flex: 1; }
    .form-alert { align-items: center; }
    .table-card { overflow-x: auto; }
    td small { display: block; font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }
    .num { text-align: right; white-space: nowrap; }
    tr.clickable { cursor: pointer; }
    tr.clickable:hover td { background: var(--color-surface-hover); }
    tr.clickable:focus-visible { outline: 2px solid var(--color-ring); outline-offset: -2px; }
    .company { display: flex; align-items: center; gap: 10px; }
    .company p { font-weight: 600; }
    .company span { font-size: 12px; color: var(--color-text-muted); }
    .note { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--color-text-muted); --icon-size: 15px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentReviewList {
  protected readonly review = inject(PlatformPaymentReview);
  private readonly router = inject(Router);
  protected readonly filters = FILTERS;
  protected readonly status = STATUS;
  protected readonly receiptCode = receiptCode;
  protected readonly filter = signal<ReviewFilter>('in_review');
  protected readonly rows = signal<ReviewRow[]>([]);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    void this.load();
    void this.review.refreshPending();
  }

  protected show(filter: ReviewFilter): void {
    this.filter.set(filter);
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loaded.set(false);
    this.failed.set(false);
    try {
      this.rows.set(await this.review.list(this.filter()));
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }

  protected open(row: ReviewRow): void {
    void this.router.navigate(['/platform/subscriptions/payments', row.id]);
  }

  protected coverage(row: ReviewRow): { text: string; tone: Tone } {
    const texts: Record<Coverage, { text: string; tone: Tone }> = {
      full: { text: 'Cubre todo', tone: 'green' },
      extra: { text: row.owedCents > 0 ? `De más · +${formatUsdCents(row.amountUsdCents - row.owedCents)}` : 'Adelantado', tone: 'teal' },
      partial: { text: `Parcial · faltan ${formatUsdCents(row.owedCents - row.amountUsdCents)}`, tone: 'amber' },
    };
    return texts[row.coverage];
  }

  protected date(day: string): string {
    return dayText(day);
  }

  protected amount(row: ReviewRow): string {
    return formatAmount(Number(row.amount), row.currency);
  }

  protected usd(cents: number): string {
    return formatUsdCents(cents);
  }

}
