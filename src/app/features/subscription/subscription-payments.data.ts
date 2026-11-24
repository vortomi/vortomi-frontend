import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import { API_CONFIG } from '../../core/api/api-config';
import { Session } from '../../core/session';
import type { PayableMethod, PaymentReport, SubscriptionPayment, Wallet } from '../../shared/api/subscriptions';
import { previewProof } from '../../shared/api/subscriptions.preview';
import { previewPayments, previewWallet } from './subscription.preview';

/** The preview's methods ('mock' mode, never deployed), as the console would set them. */
const PREVIEW_METHODS: PayableMethod[] = [
  {
    id: 'method-pago-movil',
    type: 'pago_movil',
    name: 'Pago móvil',
    currency: 'VES',
    fields: [
      { kind: 'bank', label: 'Banco', value: '0134 · Banesco', copyable: true },
      { kind: 'phone', label: 'Teléfono', value: '0412-5550199', copyable: true },
      { kind: 'document', label: 'RIF', value: 'J-50123456-7', copyable: true },
    ],
    instructions: 'Paga el monto exacto en bolívares.',
    referenceRule: 'required',
    receiptRule: 'required',
  },
  {
    id: 'method-transfer',
    type: 'transfer_national',
    name: 'Transferencia',
    currency: 'VES',
    fields: [
      { kind: 'bank', label: 'Banco', value: '0134 · Banesco', copyable: true },
      { kind: 'text', label: 'Cuenta', value: '0134 0123 45 0123456789', copyable: true },
      { kind: 'text', label: 'Titular', value: 'Vortomi, C.A.', copyable: true },
      { kind: 'document', label: 'RIF', value: 'J-50123456-7', copyable: true },
    ],
    instructions: '',
    referenceRule: 'required',
    receiptRule: 'optional',
  },
  {
    id: 'method-zelle',
    type: 'zelle',
    name: 'Zelle',
    currency: 'USD',
    fields: [
      { kind: 'text', label: 'Correo', value: 'pagos@vortomi.com', copyable: true },
      { kind: 'text', label: 'A nombre de', value: 'Vortomi LLC', copyable: true },
    ],
    instructions: '',
    referenceRule: 'required',
    receiptRule: 'optional',
  },
  {
    id: 'method-binance',
    type: 'binance',
    name: 'Binance',
    currency: 'USD',
    fields: [{ kind: 'text', label: 'Binance ID', value: '458112907', copyable: true }],
    instructions: 'Envía USDT por Binance Pay.',
    referenceRule: 'required',
    receiptRule: 'optional',
  },
];

/**
 * The company's payments to Vortomi (documentations/18 §5): the methods it pays with, what it
 * reported, and reporting or correcting one. Only its owner and admins. In the preview they live
 * in memory.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionPayments {
  private readonly api = inject(ApiClient);
  private readonly session = inject(Session);
  private readonly live = inject(API_CONFIG).mode === 'api';
  /** «?estado=active» starts with a paid month whose extra went to the wallet. */
  private preview: SubscriptionPayment[] = previewPayments(location.search);

  readonly items = signal<SubscriptionPayment[]>([]);
  readonly loaded = signal(false);
  readonly failed = signal(false);

  async methods(): Promise<PayableMethod[]> {
    if (!this.live) return PREVIEW_METHODS;
    return (await this.api.get<{ items: PayableMethod[] }>(this.path('subscription/methods'))).items;
  }

  async load(): Promise<void> {
    this.failed.set(false);
    try {
      this.items.set(this.live ? (await this.api.get<{ items: SubscriptionPayment[] }>(this.path('subscription/payments'))).items : this.preview);
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }

  /** A new payment, or a rejected one corrected (`paymentId`): in review either way. */
  async send(report: PaymentReport, paymentId: string | null, method: PayableMethod, bsPerUsd: string | null): Promise<SubscriptionPayment> {
    if (!this.live) return this.previewSend(report, paymentId, method, bsPerUsd);
    const payment = paymentId
      ? (await this.api.put<{ payment: SubscriptionPayment }>(this.path(`subscription/payments/${encodeURIComponent(paymentId)}`), report)).payment
      : (await this.api.post<{ payment: SubscriptionPayment }>(this.path('subscription/payments'), report)).payment;
    this.items.update((items) => [payment, ...items.filter((p) => p.id !== payment.id)]);
    return payment;
  }

  /** The receipt (comprobante) a payment was sent with. */
  proof(paymentId: string): Promise<Blob> {
    if (!this.live) return Promise.resolve(previewProof());
    return this.api.blob(this.path(`subscription/payments/${encodeURIComponent(paymentId)}/proof`));
  }

  /** Vortomi's receipt (recibo) of an approved payment, a PDF. */
  receipt(paymentId: string): Promise<Blob> {
    if (!this.live) return Promise.reject(new Error('No receipts in the preview'));
    return this.api.blob(this.path(`subscription/payments/${encodeURIComponent(paymentId)}/receipt`));
  }

  /** The balance in favour and its movements. */
  async wallet(): Promise<Wallet> {
    if (!this.live) return previewWallet(location.search);
    return this.api.get<Wallet>(this.path('subscription/wallet'));
  }

  private path(rest: string): string {
    const tenantId = this.session.tenant()?.id;
    if (!tenantId) throw new Error('No company in the session');
    return this.api.company(tenantId, rest);
  }

  private previewSend(report: PaymentReport, paymentId: string | null, method: PayableMethod, bsPerUsd: string | null): SubscriptionPayment {
    const cents = method.currency === 'USD' ? Math.round(Number(report.amount) * 100) : Math.round((Number(report.amount) / Number(bsPerUsd ?? '1')) * 100);
    const payment: SubscriptionPayment = {
      id: paymentId ?? crypto.randomUUID(),
      status: 'in_review',
      months: report.months,
      methodId: method.id,
      methodName: method.name,
      methodType: method.type,
      currency: method.currency,
      payer: report.payer,
      reference: report.reference ?? null,
      paidOn: report.paidOn,
      amount: report.amount,
      bsPerUsd: method.currency === 'VES' ? bsPerUsd : null,
      amountUsdCents: cents,
      hasProof: !!report.proof || !!this.preview.find((p) => p.id === paymentId)?.hasProof,
      rejectionReason: null,
      rejectionNote: null,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      receiptNumber: null,
    };
    this.preview = [payment, ...this.preview.filter((p) => p.id !== payment.id)];
    this.items.set(this.preview);
    return payment;
  }
}
