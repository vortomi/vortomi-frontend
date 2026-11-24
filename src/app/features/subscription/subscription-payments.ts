import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Tone } from '../../shared/api/models';
import type { SubscriptionPayment, Wallet } from '../../shared/api/subscriptions';
import { formatAmount, formatUsdCents } from '../../shared/format/money';
import { receiptCode } from '../../shared/format/receipt-code';
import { FileViewerDialog } from '../../shared/ui/file-viewer.dialog';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { SubscriptionPayments } from './subscription-payments.data';
import { dayText } from './subscription.rules';

const STATUS: Record<SubscriptionPayment['status'], { text: string; tone: Tone }> = {
  in_review: { text: 'En revisión', tone: 'blue' },
  approved: { text: 'Aprobado', tone: 'green' },
  rejected: { text: 'Rechazado', tone: 'red' },
};

const REASON: Record<string, string> = {
  reference_not_found: 'Referencia no encontrada',
  amount_mismatch: 'El monto no coincide',
  unreadable_proof: 'El comprobante no se lee',
  wrong_method: 'No llegó a ese método',
  other: 'Otro motivo',
};

/**
 * Suscripción → Pagos (mockup web-39, frame 5): every payment the company reported, with its state;
 * a rejected one says why and can be corrected; the receipt opens. On phones the table turns into
 * a list of cards.
 */
@Component({
  selector: 'app-subscription-payments',
  imports: [FileViewerDialog, Icon, Pill, RouterLink, Skeleton],
  template: `
    @if (wallet(); as w) {
      @if (w.balanceCents > 0 || w.movements.length) {
        <section class="card wallet">
          <div class="head"><app-icon name="dollar" /><span>Saldo a favor</span><b>{{ usd(w.balanceCents) }}</b><small>Se descuenta solo en tu próximo cobro</small></div>
          @if (w.movements.length) {
            <ul>
              @for (m of w.movements; track m.id) {
                <li><span>{{ moment(m.createdAt) }} · {{ m.kind === 'excess' ? 'Lo que pagaste de más' : 'Usado en tu cobro' }}</span>
                  <b [class.plus]="m.amountCents > 0">{{ m.amountCents > 0 ? '+' : '' }}{{ usd(m.amountCents) }}</b></li>
              }
            </ul>
          }
        </section>
      }
    }
    @if (payments.failed()) {
      <div class="form-alert" role="alert"><app-icon name="alert" /><span class="grow">No pudimos cargar tus pagos.</span>
        <button type="button" class="btn btn--sm" (click)="payments.load()"><span>Reintentar</span></button></div>
    } @else if (!payments.loaded()) {
      <app-skeleton kind="table" [rows]="3" />
    } @else if (!payments.items().length) {
      <div class="card"><p class="empty-state"><app-icon name="dollar" />Todavía no tienes pagos.</p></div>
    } @else {
      <div class="card table-card">
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Método</th><th class="num">Monto</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (p of payments.items(); track p.id) {
              <tr>
                <td data-label="Fecha">{{ date(p.paidOn) }}</td>
                <td data-label="Método">{{ p.methodName }}@if (p.reference) { <small>Ref. {{ p.reference }}</small> }</td>
                <td class="num" data-label="Monto">{{ amount(p) }}@if (p.currency === 'VES') { <small>{{ usd(p.amountUsdCents) }}</small> }</td>
                <td data-label="Estado"><app-pill [tone]="status[p.status].tone" [dot]="true">{{ status[p.status].text }}</app-pill>
                  @if (p.status === 'rejected') { <small>{{ reason(p) }}@if (p.rejectionNote) { · {{ p.rejectionNote }} }</small> }</td>
                <td class="acts">
                  @if (p.status === 'rejected') { <a class="link" [routerLink]="['/subscription/payments', p.id, 'edit']">Corregir</a> }
                  @if (p.receiptNumber) { <button type="button" class="link" (click)="downloadReceipt(p)">Recibo</button> }
                  @if (p.hasProof) { <button type="button" class="link" (click)="viewing.set(p)">Ver comprobante</button> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
    @if (viewing(); as p) {
      <app-file-viewer-dialog [open]="true" [title]="'Comprobante · ' + p.methodName + (p.reference ? ' ' + p.reference : '')" [load]="proofOf(p)"
        [fileName]="'comprobante-' + (p.reference ?? p.id)" (closed)="viewing.set(null)" />
    }
    <p class="note">Un pago <app-pill tone="blue" [dot]="true">En revisión</app-pill> no se puede cambiar. Si te lo rechazamos, verás el motivo y podrás corregirlo y volver a enviarlo.</p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .grow { flex: 1; }
    .form-alert { align-items: center; }
    .table-card { overflow-x: auto; }
    td small { display: block; font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }
    .num { text-align: right; white-space: nowrap; }
    .acts { white-space: nowrap; text-align: right; }
    .acts .link + .link { margin-left: 12px; }
    .link { border: 0; background: none; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--color-primary-text); cursor: pointer; }
    .wallet { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
    .wallet .head { display: flex; align-items: center; gap: 8px; font-size: 14px; --icon-size: 18px; }
    .wallet .head app-icon { color: var(--color-success); }
    .wallet .head b { font-size: 17px; }
    .wallet .head small { margin-left: auto; font-size: 12.5px; color: var(--color-text-muted); }
    .wallet ul { list-style: none; display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--color-border); padding-top: 8px; font-size: 13px; }
    .wallet li { display: flex; justify-content: space-between; gap: 12px; color: var(--color-text-2); }
    .wallet li b.plus { color: var(--color-success-text); }
    .note { font-size: 13px; color: var(--color-text-muted); line-height: 1.7; }
    /* Phones: each payment is a card, its data one under the other. */
    @media (max-width: 760px) {
      .table-card { background: none; border: 0; box-shadow: none; }
      thead { display: none; }
      table, tbody, tr, td { display: block; width: 100%; }
      tr { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 10px 14px; margin-bottom: 10px; }
      .table-card .data-table td { border: 0; padding: 3px 0; text-align: left; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionPaymentList {
  protected readonly payments = inject(SubscriptionPayments);
  private readonly toaster = inject(Toaster);
  protected readonly status = STATUS;

  /** The payment whose «Ver comprobante» is open. */
  protected readonly viewing = signal<SubscriptionPayment | null>(null);
  protected readonly wallet = signal<Wallet | null>(null);

  constructor() {
    void this.payments.load();
    this.payments.wallet().then(
      (w) => this.wallet.set(w),
      () => this.wallet.set(null),
    );
  }

  protected date(day: string): string {
    return dayText(day, true);
  }

  protected amount(p: SubscriptionPayment): string {
    return formatAmount(Number(p.amount), p.currency);
  }

  protected usd(cents: number): string {
    return formatUsdCents(cents);
  }

  protected reason(p: SubscriptionPayment): string {
    return REASON[p.rejectionReason ?? ''] ?? 'Rechazado';
  }

  /** «Recibo»: Vortomi's PDF of an approved payment, saved with its number as name. */
  protected async downloadReceipt(p: SubscriptionPayment): Promise<void> {
    try {
      const url = URL.createObjectURL(await this.payments.receipt(p.id));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Recibo-${receiptCode(p.receiptNumber ?? 0)}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      this.toaster.show('No pudimos descargar el recibo.', 'info');
    }
  }

  protected proofOf(p: SubscriptionPayment): () => Promise<Blob> {
    return () => this.payments.proof(p.id);
  }

  protected moment(at: string): string {
    return dayText(at.slice(0, 10), true);
  }

}
