import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '../../../core/api/api-client';
import { API_CONFIG } from '../../../core/api/api-config';
import type { Id } from '../../../shared/api/models';
import type { PaymentRejectionReason, ReviewDetail, ReviewRow } from '../../../shared/api/subscriptions';
import { previewProof } from '../../../shared/api/subscriptions.preview';

export type ReviewFilter = ReviewRow['status'] | 'all';

/** The preview's payments to review ('mock' mode, never deployed). */
function previewPayments(): ReviewDetail[] {
  const today = new Date().toISOString().slice(0, 10);
  const base = {
    payment: {
      id: 'review-1',
      status: 'in_review' as const,
      months: 3,
      methodId: 'method-pago-movil',
      methodName: 'Pago móvil Banesco',
      methodType: 'pago_movil',
      currency: 'VES' as const,
      payer: { bank: '0102 · Banco de Venezuela', phone: '0414-1234567', document: 'V-18456789' },
      reference: '000451287',
      paidOn: today,
      amount: '92435.33',
      bsPerUsd: '410.55000000',
      amountUsdCents: 22515,
      hasProof: true,
      rejectionReason: null,
      rejectionNote: null,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      receiptNumber: null,
      receivedAmount: null,
      receivedUsdCents: null,
    },
    charge: { months: 3, amountCents: 22515, paidCents: 0, dueOn: today, discountPercent: 5 },
    billingDay: null,
    nextDueOn: today,
  };
  const first: ReviewDetail = {
    ...base,
    id: 'review-1',
    tenantId: 'tenant-campina',
    tenantName: 'Agua Potable La Campiña',
    status: 'in_review',
    planName: 'Vortomi',
    months: 3,
    methodName: 'Pago móvil Banesco',
    reference: '000451287',
    paidOn: today,
    submittedAt: new Date().toISOString(),
    currency: 'VES',
    amount: '92435.33',
    amountUsdCents: 22515,
    owedCents: 22515,
    coverage: 'full',
    receiptNumber: null,
  };
  const second: ReviewDetail = {
    ...first,
    id: 'review-2',
    tenantId: 'tenant-demo',
    tenantName: 'Vortomi Demo',
    months: 1,
    methodName: 'Zelle',
    reference: 'Q7K2X9M4P',
    currency: 'USD',
    amount: '50.00',
    amountUsdCents: 5000,
    owedCents: 7900,
    coverage: 'partial',
    payment: { ...base.payment, id: 'review-2', methodName: 'Zelle', methodType: 'zelle', currency: 'USD', payer: { senderName: 'Rosa Gil', senderContact: 'rosa@gmail.com' }, reference: 'Q7K2X9M4P', amount: '50.00', bsPerUsd: null, amountUsdCents: 5000, hasProof: false },
    charge: { months: 1, amountCents: 7900, paidCents: 0, dueOn: today, discountPercent: 0 },
  };
  return [first, second];
}

/**
 * Suscripciones → Pagos (mockup web-41): the payments companies report, reviewed by our team.
 * Approve for what really arrived, or reject with a reason. Keeps the count of those waiting for the
 * console's menu. In the preview without a server they live in memory.
 */
@Injectable({ providedIn: 'root' })
export class PlatformPaymentReview {
  private readonly api = inject(ApiClient);
  private readonly live = inject(API_CONFIG).mode === 'api';
  private preview: ReviewDetail[] | null = null;

  /** How many wait for review (the menu's count). */
  readonly pending = signal(0);

  async list(filter: ReviewFilter): Promise<ReviewRow[]> {
    if (!this.live) return this.previewAll().filter((p) => filter === 'all' || p.status === filter);
    return (await this.api.get<{ items: ReviewRow[] }>('platform/subscription-payments', { status: filter })).items;
  }

  async refreshPending(): Promise<void> {
    try {
      this.pending.set(
        this.live ? (await this.api.get<{ count: number }>('platform/subscription-payments/pending-count')).count : this.previewAll().filter((p) => p.status === 'in_review').length,
      );
    } catch {
      // The count is a help: a failed read leaves the last one.
    }
  }

  async detail(paymentId: Id): Promise<ReviewDetail> {
    if (!this.live) {
      const found = this.previewAll().find((p) => p.id === paymentId);
      if (!found) throw new Error('Payment not found');
      return found;
    }
    return (await this.api.get<{ payment: ReviewDetail }>(`platform/subscription-payments/${encodeURIComponent(paymentId)}`)).payment;
  }

  proof(row: Pick<ReviewRow, 'tenantId' | 'id'>): Promise<Blob> {
    if (!this.live) return Promise.resolve(previewProof());
    return this.api.blob(this.path(row, 'proof'));
  }

  receipt(row: Pick<ReviewRow, 'tenantId' | 'id'>): Promise<Blob> {
    if (!this.live) return Promise.reject(new Error('No receipts in the preview'));
    return this.api.blob(this.path(row, 'receipt'));
  }

  async approve(row: Pick<ReviewRow, 'tenantId' | 'id'>, receivedAmount: string | null): Promise<ReviewDetail> {
    const detail = this.live
      ? (await this.api.post<{ payment: ReviewDetail }>(this.path(row, 'approve'), receivedAmount ? { receivedAmount } : {})).payment
      : this.previewDecide(row.id, { status: 'approved', receiptNumber: 1 });
    await this.refreshPending();
    return detail;
  }

  async reject(row: Pick<ReviewRow, 'tenantId' | 'id'>, reason: PaymentRejectionReason, note: string): Promise<ReviewDetail> {
    const detail = this.live
      ? (await this.api.post<{ payment: ReviewDetail }>(this.path(row, 'reject'), { reason, note })).payment
      : this.previewDecide(row.id, { status: 'rejected' }, { rejectionReason: reason, rejectionNote: note || null });
    await this.refreshPending();
    return detail;
  }

  private path(row: Pick<ReviewRow, 'tenantId' | 'id'>, action: string): string {
    return `platform/tenants/${encodeURIComponent(row.tenantId)}/subscription-payments/${encodeURIComponent(row.id)}/${action}`;
  }

  private previewAll(): ReviewDetail[] {
    this.preview ??= previewPayments();
    return this.preview;
  }

  private previewDecide(id: Id, change: Partial<ReviewDetail>, paymentChange: Partial<ReviewDetail['payment']> = {}): ReviewDetail {
    this.preview = this.previewAll().map((p) =>
      p.id === id ? { ...p, ...change, payment: { ...p.payment, status: change.status ?? p.status, ...paymentChange, reviewedAt: new Date().toISOString() } } : p,
    );
    return this.preview.find((p) => p.id === id)!;
  }
}
