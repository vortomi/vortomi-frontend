import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiFailure } from '../../../core/api/api-error';
import type { Tone } from '../../../shared/api/models';
import type { PaymentRejectionReason, ReviewDetail } from '../../../shared/api/subscriptions';
import { formatAmount, formatUsdCents } from '../../../shared/format/money';
import { receiptCode } from '../../../shared/format/receipt-code';
import { FileViewerDialog } from '../../../shared/ui/file-viewer.dialog';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';
import { Skeleton } from '../../../shared/ui/skeleton';
import { Toaster } from '../../../shared/ui/toaster';
import { ApprovePaymentDialog } from './approve-payment.dialog';
import { addDays, dayText } from './billing.rules';
import { PlatformPaymentReview } from './platform-payment-review';
import { RejectPaymentDialog } from './reject-payment.dialog';
import { PAYER_LABEL, REJECTION_REASONS } from './review.rules';

const STATUS: Record<ReviewDetail['status'], { text: string; tone: Tone }> = {
  in_review: { text: 'En revisión', tone: 'blue' },
  approved: { text: 'Aprobado', tone: 'green' },
  rejected: { text: 'Rechazado', tone: 'red' },
};

/**
 * «Revisar pago» (mockup web-41, frame 2): what the company owes on the left, what it reported
 * (each datum of its method, and the conversion at the rate of the day) and its receipt on the
 * right, with «Aprobar» and «Rechazar». Decided, it shows how, and the receipt (approved).
 */
@Component({
  selector: 'app-payment-review-page',
  imports: [ApprovePaymentDialog, FileViewerDialog, Icon, Pill, RejectPaymentDialog, RouterLink, Skeleton],
  templateUrl: './payment-review.page.html',
  styleUrls: ['../platform-pages.scss', './payment-review.page.scss'],
})
export class PaymentReviewPage {
  /** From the route: /platform/subscriptions/payments/:paymentId. */
  readonly paymentId = input<string>();

  private readonly review = inject(PlatformPaymentReview);
  private readonly toaster = inject(Toaster);
  protected readonly status = STATUS;
  protected readonly receiptCode = receiptCode;

  protected readonly detail = signal<ReviewDetail | null>(null);
  protected readonly failed = signal(false);
  protected readonly proofUrl = signal<string | null>(null);
  protected readonly proofIsPdf = signal(false);
  protected readonly viewing = signal(false);
  protected readonly approving = signal(false);
  protected readonly rejecting = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly payer = computed(() => Object.entries(this.detail()?.payment.payer ?? {}).map(([key, value]) => ({ label: PAYER_LABEL[key] ?? key, value })));
  protected readonly reason = computed(() => REJECTION_REASONS.find((r) => r.value === this.detail()?.payment.rejectionReason)?.label ?? null);
  protected readonly coverage = computed(() => {
    const d = this.detail();
    if (!d) return null;
    if (d.owedCents <= 0) return { tone: 'teal' as Tone, text: 'No debe nada: es un pago adelantado.' };
    const diff = d.amountUsdCents - d.owedCents;
    if (Math.abs(diff) <= 1) return { tone: 'green' as Tone, text: 'Cubre todo lo que debe.' };
    if (diff > 0) return { tone: 'teal' as Tone, text: `Cubre todo; ${formatUsdCents(diff)} irían a su saldo a favor.` };
    return { tone: 'amber' as Tone, text: `Es parcial: faltarían ${formatUsdCents(-diff)}.` };
  });

  constructor() {
    effect(() => {
      const id = this.paymentId();
      if (id) untracked(() => void this.load(id));
    });
  }

  protected proofLoader = () => {
    const d = this.detail();
    return d ? this.review.proof(d) : Promise.reject(new Error('No payment'));
  };

  protected async approve(receivedAmount: string | null): Promise<void> {
    const d = this.detail();
    if (!d) return;
    await this.decide(async () => {
      this.detail.set(await this.review.approve(d, receivedAmount));
      this.approving.set(false);
      this.toaster.show(`Pago de ${d.tenantName} aprobado. Se generó su recibo.`);
    });
  }

  protected async reject(change: { reason: PaymentRejectionReason; note: string }): Promise<void> {
    const d = this.detail();
    if (!d) return;
    await this.decide(async () => {
      this.detail.set(await this.review.reject(d, change.reason, change.note));
      this.rejecting.set(false);
      this.toaster.show(`Pago de ${d.tenantName} rechazado. La empresa verá el motivo.`);
    });
  }

  protected async downloadReceipt(): Promise<void> {
    const d = this.detail();
    if (!d) return;
    try {
      const url = URL.createObjectURL(await this.review.receipt(d));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Recibo-${receiptCode(d.receiptNumber ?? 0)}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      this.toaster.show('No pudimos descargar el recibo.', 'info');
    }
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected amount(d: ReviewDetail): string {
    return formatAmount(Number(d.amount), d.currency);
  }

  protected rate(value: string): string {
    return `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} Bs/$`;
  }

  protected date(day: string): string {
    return dayText(day, true);
  }

  protected suspends(day: string): string {
    return dayText(addDays(day, 3));
  }

  private async decide(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await work();
    } catch (error) {
      this.error.set(toApiFailure(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.failed.set(false);
    try {
      const d = await this.review.detail(id);
      this.detail.set(d);
      if (d.payment.hasProof) void this.loadProof(d);
    } catch {
      this.failed.set(true);
    }
  }

  /** The receipt shown on the right of the page (and in large in «Ver comprobante»). */
  private async loadProof(d: ReviewDetail): Promise<void> {
    try {
      const blob = await this.review.proof(d);
      this.proofIsPdf.set(blob.type === 'application/pdf');
      if (!this.proofIsPdf()) this.proofUrl.set(URL.createObjectURL(blob));
    } catch {
      this.proofUrl.set(null);
    }
  }
}
