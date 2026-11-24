import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import type { PaymentHistory } from '../../../shared/api/subscriptions';
import { formatUsdCents, formatVes } from '../../../shared/format/money';
import { receiptCode } from '../../../shared/format/receipt-code';
import { Toaster } from '../../../shared/ui/toaster';
import { dayText } from './billing.rules';
import { PlatformSubscriptions } from './platform-subscriptions';

/**
 * A company's approved payments on its page in the console (mockup web-51, frame 3): what it has
 * paid in total, and each payment with what it paid until and its receipt.
 */
@Component({
  selector: 'app-tenant-payment-history',
  template: `
    <!-- A company that never paid shows nothing here. -->
    @if (history(); as h) { @if (h.count) {
      <p class="total">Pagado en total<b>{{ money(h.totalCents) }} · {{ h.count }} {{ h.count === 1 ? 'pago' : 'pagos' }}</b></p>
      @if (h.items.length) {
        <h3>Historial de pagos</h3>
        <ul class="list">
          @for (p of h.items; track p.id) {
            <li>
              <div class="line"><span>{{ date(p.paidOn) }} · {{ p.months }} {{ p.months === 1 ? 'mes' : 'meses' }}</span><b>{{ money(p.receivedCents) }}</b></div>
              <div class="line sub">
                <span>@if (p.coversTo) { Hasta {{ date(p.coversTo) }} · }{{ p.methodName }}@if (p.currency === 'VES') { · {{ bs(p.receivedAmount) }} }</span>
                @if (p.receiptNumber; as n) { <button type="button" class="link" [attr.aria-label]="'Descargar recibo ' + code(n)" (click)="download(p.id, n)">Recibo</button> }
              </div>
            </li>
          }
        </ul>
      }
    } }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; }
    .total { display: flex; gap: 12px; font-size: 13.5px; color: var(--color-text-muted); }
    .total b { margin-left: auto; color: var(--color-text); font-weight: 600; font-variant-numeric: tabular-nums; }
    h3 { font-size: 14px; font-weight: 600; margin-top: 4px; }
    .list { list-style: none; display: flex; flex-direction: column; }
    .list li { display: flex; flex-direction: column; gap: 2px; padding: 9px 0; border-top: 1px solid var(--color-border); }
    .line { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 13.5px; }
    .line b { font-variant-numeric: tabular-nums; }
    .line.sub { font-size: 12.5px; color: var(--color-text-muted); }
    .link { border: 0; background: none; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--color-primary-text); cursor: pointer; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantPaymentHistory {
  readonly tenantId = input.required<string>();

  private readonly subscriptions = inject(PlatformSubscriptions);
  private readonly toaster = inject(Toaster);
  protected readonly history = signal<PaymentHistory | null>(null);

  constructor() {
    effect(() => {
      const id = this.tenantId();
      untracked(() => void this.load(id));
    });
  }

  /** Read again after a change on the page (a payment approved elsewhere shows on the next visit). */
  async load(tenantId = this.tenantId()): Promise<void> {
    try {
      this.history.set(await this.subscriptions.history(tenantId));
    } catch {
      this.history.set(null);
    }
  }

  protected async download(paymentId: string, n: number): Promise<void> {
    try {
      const url = URL.createObjectURL(await this.subscriptions.receipt(this.tenantId(), paymentId));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Recibo-${receiptCode(n)}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      this.toaster.show('No pudimos descargar el recibo.', 'info');
    }
  }

  protected code(n: number): string {
    return receiptCode(n);
  }

  protected date(day: string): string {
    return dayText(day, true);
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected bs(amount: string): string {
    return formatVes(Number(amount));
  }
}
