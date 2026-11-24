import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toApiFailure } from '../../core/api/api-error';
import type { PaymentFieldKind } from '../../shared/api/models';
import type { PayableMethod, PaymentReport, SubscriptionPayment } from '../../shared/api/subscriptions';
import { formatUsdCents, formatVes } from '../../shared/format/money';
import { DatePicker } from '../../shared/ui/date-picker';
import { Icon } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { FieldValueInput } from '../payment-methods/field-value-input';
import { PayMethodPicker } from './pay-method-picker';
import { REPORT_WINDOW_DAYS, formOf, normalizeReference, parseTypedAmount, reportErrors, typedUsdCents } from './payment-forms';
import { type ChosenProof, ProofField } from './proof-field';
import { SubscriptionData } from './subscription.data';
import { PERIODS, type Period } from './subscription.models';
import { SubscriptionPayments } from './subscription-payments.data';
import { addDays, amountToPay, dayText, inBolivares, lastPayDay, priceFor } from './subscription.rules';

const plain = (amount: number) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

/** Why the console rejected a payment, in the company's words (stage 4 sets them). */
const REJECTION_TEXT: Record<string, string> = {
  reference_not_found: 'Referencia no encontrada',
  amount_mismatch: 'El monto no coincide',
  unreadable_proof: 'El comprobante no se lee',
  wrong_method: 'No llegó a ese método',
  other: 'Otro motivo',
};

/**
 * «Reportar pago» and «Corregir pago» (mockups web-39 and web-40): the method chosen and its data,
 * its own form (who paid, the reference in its format), the date typed or picked (within the last 7
 * days), the amount in the method's currency with what it covers, and the receipt. Checked here as
 * the server checks it; a rejected payment comes back with its data and the reason.
 */
@Component({
  selector: 'app-report-payment-page',
  imports: [DatePicker, FieldValueInput, Icon, PayMethodPicker, ProofField, RouterLink, Skeleton],
  templateUrl: './report-payment.page.html',
  styleUrl: './report-payment.page.scss',
})
export class ReportPaymentPage {
  /** From the route: /subscription/payments/:paymentId/edit. */
  readonly paymentId = input<string>();
  /** From ?months=, the months chosen on Resumen. */
  readonly months = input<string>();

  protected readonly data = inject(SubscriptionData);
  private readonly payments = inject(SubscriptionPayments);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly periods = PERIODS;
  protected readonly methods = signal<PayableMethod[]>([]);
  protected readonly ready = signal(false);
  protected readonly loadFailed = signal(false);
  /** The rejected payment being corrected; null for a new one. */
  protected readonly editing = signal<SubscriptionPayment | null>(null);

  protected readonly method = signal<PayableMethod | null>(null);
  protected readonly chosenMonths = signal<Period>(1);
  protected readonly payer = signal<Record<string, string>>({});
  protected readonly reference = signal('');
  protected readonly paidOn = signal<string | null>(null);
  protected readonly amount = signal('');
  /** The amount was typed by the person: choosing another method no longer replaces it. */
  private amountTyped = false;
  protected readonly proof = signal<ChosenProof | null>(null);
  protected readonly attempted = signal(false);
  protected readonly sending = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly today = computed(() => this.data.today());
  protected readonly oldest = computed(() => addDays(this.today(), -REPORT_WINDOW_DAYS));
  protected readonly window = REPORT_WINDOW_DAYS;
  protected readonly form = computed(() => (this.method() ? formOf(this.method()!.type) : null));
  protected readonly rate = computed(() => this.data.subscription()?.rate?.bsPerUsd ?? this.data.rate()?.bsPerUsd ?? null);
  protected readonly rejection = computed(() => {
    const p = this.editing();
    return p ? { reason: REJECTION_TEXT[p.rejectionReason ?? ''] ?? 'Rechazado', note: p.rejectionNote } : null;
  });

  /** The months can change while nothing of the charge is paid. */
  protected readonly monthsEditable = computed(() => (this.data.subscription()?.charge?.paidCents ?? 0) === 0);

  /** What the months chosen cost now, in dollar cents: the open charge, or, with nothing owed, the next period. */
  protected readonly dueCents = computed(() => {
    const s = this.data.subscription();
    if (!s) return 0;
    return s.charge ? amountToPay(s, this.chosenMonths()).dueCents : priceFor(s.plan, this.chosenMonths()).totalCents;
  });
  protected readonly dueText = computed(() => {
    const m = this.method();
    const cents = this.dueCents();
    if (!m) return formatUsdCents(cents);
    if (m.currency === 'USD') return formatUsdCents(cents);
    const rate = this.rate();
    return rate ? formatVes(inBolivares(cents, rate)) : null;
  });
  protected readonly duePlain = computed(() => {
    const m = this.method();
    const cents = this.dueCents();
    const rate = this.rate();
    return m?.currency === 'VES' && rate ? plain(inBolivares(cents, rate)) : plain(cents / 100);
  });

  protected readonly errors = computed(() => {
    const m = this.method();
    if (!m) return { method: 'Elige cómo pagaste.' } as Record<string, string>;
    const proof = this.proof();
    return reportErrors(
      m,
      {
        payer: this.payer(),
        reference: this.reference(),
        paidOn: this.paidOn(),
        amount: this.amount(),
        proof: proof ? { name: proof.name, size: proof.size, mimeType: proof.mimeType } : null,
        keepsProof: !!this.editing()?.hasProof,
      },
      this.today(),
    );
  });
  protected readonly shown = computed<Record<string, string>>(() => (this.attempted() ? this.errors() : {}));
  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  /** What the amount typed covers (mockup web-39, frame 3). */
  protected readonly coverage = computed(() => {
    const m = this.method();
    const cents = m ? typedUsdCents(this.amount(), m.currency, this.rate()) : null;
    const s = this.data.subscription();
    if (cents === null || !s) return null;
    const due = this.dueCents();
    const advance = !s.charge;
    // A cent of rounding in the conversion is not a debt.
    if (cents >= due - 1) {
      const extra = cents - due;
      const covers = advance ? `Cubre tu próximo período: tu fecha de pago se mueve ${this.chosenMonths()} ${this.chosenMonths() === 1 ? 'mes' : 'meses'}.` : 'Cubre todo lo que debes.';
      return { full: true, text: extra > 1 ? `${covers} Los ${formatUsdCents(extra)} de más quedan en tu saldo a favor y se usan solos en tu próximo cobro.` : covers };
    }
    if (advance) return { full: false, text: 'Es menos que tu próximo período: irá a tu saldo a favor y se descontará solo en tu próximo cobro.' };
    return {
      full: false,
      text: `Es un pago parcial. Al aprobarse seguirás debiendo ${formatUsdCents(due - cents)}, y debes pagarlos antes del ${dayText(lastPayDay(s))} a las 11:59 p. m. para que tu cuenta no se suspenda.`,
    };
  });

  constructor() {
    void this.start();
  }

  protected asKind(kind: string): PaymentFieldKind {
    return kind as PaymentFieldKind;
  }

  protected chooseMethod(method: PayableMethod): void {
    if (method.id === this.method()?.id) return;
    this.method.set(method);
    // Who paid depends on the method: what was typed for another one does not fit.
    // A cédula starts as V: whoever pays is most often a person.
    const fresh = Object.fromEntries((formOf(method.type)?.payer ?? []).filter((f) => f.kind === 'document').map((f) => [f.key, 'V-']));
    this.payer.set(method.type === this.editing()?.methodType ? (this.editing()?.payer ?? {}) : fresh);
    this.serverError.set(null);
    if (!this.amountTyped) this.amount.set(this.duePlain());
  }

  protected chooseMonths(months: Period): void {
    this.chosenMonths.set(months);
    if (!this.amountTyped) this.amount.set(this.duePlain());
  }

  protected setPayer(key: string, value: string): void {
    this.payer.update((p) => ({ ...p, [key]: value }));
  }

  protected typeAmount(event: Event): void {
    this.amountTyped = true;
    this.amount.set((event.target as HTMLInputElement).value);
  }

  protected typeReference(event: Event): void {
    this.reference.set((event.target as HTMLInputElement).value);
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    this.attempted.set(true);
    const m = this.method();
    if (!m || Object.keys(this.errors()).length) return;
    const form = formOf(m.type)!;
    const proof = this.proof();
    const report: PaymentReport = {
      methodId: m.id,
      months: this.chosenMonths(),
      paidOn: this.paidOn()!,
      amount: parseTypedAmount(this.amount())!,
      payer: Object.fromEntries(form.payer.map((f) => [f.key, (this.payer()[f.key] ?? '').trim()])),
      ...(form.reference ? { reference: normalizeReference(this.reference()) } : {}),
      ...(proof ? { proof: { mimeType: proof.mimeType, data: proof.data } } : this.editing() ? {} : { proof: null }),
    };
    this.sending.set(true);
    this.serverError.set(null);
    try {
      const payment = await this.payments.send(report, this.editing()?.id ?? null, m, this.rate());
      await this.data.afterPayment(payment);
      this.toaster.show('Recibimos tu pago. Lo revisamos y te avisamos aquí.');
      void this.router.navigateByUrl('/subscription');
    } catch (error) {
      this.serverError.set(toApiFailure(error).message);
    } finally {
      this.sending.set(false);
    }
  }

  private async start(): Promise<void> {
    try {
      if (!this.data.loaded()) await this.data.load();
      const methods = await this.payments.methods();
      this.methods.set(methods);
      const id = this.paymentId();
      if (id) {
        if (!this.payments.loaded()) await this.payments.load();
        const payment = this.payments.items().find((p) => p.id === id && p.status === 'rejected') ?? null;
        this.editing.set(payment);
        if (payment) this.prefill(payment, methods);
      } else {
        const asked = PERIODS.find((p) => String(p) === this.months());
        this.chosenMonths.set(asked ?? PERIODS.find((p) => p === this.data.subscription()?.charge?.months) ?? 1);
      }
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.ready.set(true);
    }
  }

  private prefill(payment: SubscriptionPayment, methods: PayableMethod[]): void {
    this.chosenMonths.set(PERIODS.find((p) => p === payment.months) ?? 1);
    this.method.set(methods.find((m) => m.id === payment.methodId) ?? null);
    this.payer.set(payment.payer);
    this.reference.set(payment.reference ?? '');
    this.paidOn.set(payment.paidOn);
    this.amount.set(plain(Number(payment.amount)));
    this.amountTyped = true;
  }
}
