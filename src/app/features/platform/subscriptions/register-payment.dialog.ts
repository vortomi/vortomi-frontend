import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import type { Id } from '../../../shared/api/models';
import { formatUsdCents, parsePriceCents } from '../../../shared/format/money';
import { DatePicker } from '../../../shared/ui/date-picker';
import { Dialog } from '../../../shared/ui/dialog';
import { FileDrop } from '../../../shared/ui/file-drop';
import { Icon } from '../../../shared/ui/icon';
import { NumericInput } from '../../../shared/ui/numeric-input';
import { type MenuOption, SelectMenu } from '../../../shared/ui/select-menu';
import type { PaymentMethod } from './subscription.models';
import { PAYMENT_METHOD_LABEL, monthOf, monthTitle } from './subscription.rules';
import { SubscriptionsStore } from './subscriptions.store';

/**
 * «Registrar un pago» (mockup web-32, step 4): writes down a payment the company already made by
 * Pago móvil, transfer, Zelle or cash. Vortomi never charges nor asks for card data. Fields one under
 * the other. With `subscriptionId` the company comes chosen (from its own page).
 */
@Component({
  selector: 'app-register-payment-dialog',
  imports: [Dialog, Icon, SelectMenu, DatePicker, FileDrop, NumericInput],
  template: `
    <app-dialog [open]="open()" title="Registrar un pago" (closed)="closed.emit()">
      <p class="lead">Anota un pago que la empresa ya hizo. Vortomi no cobra ni guarda datos de tarjetas.</p>
      @if (error(); as message) {
        <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
      }
      <div class="fields">
        <div class="field">
          <label for="rp-company">Empresa</label>
          <app-select-menu id="rp-company" label="Empresa" placeholder="Elige la empresa" [options]="companies()" [value]="companyId()"
            [searchable]="companies().length > 7" [disabled]="!!subscriptionId()" (picked)="pickCompany($event)" />
          @if (owed(); as text) { <p class="field-hint">{{ text }}</p> }
        </div>
        <div class="field">
          <label for="rp-amount">Monto en dólares</label>
          <input id="rp-amount" class="input" appNumeric="money" inputmode="decimal" autocomplete="off" [value]="amount()" (input)="amount.set(value($event))" />
          <p class="field-hint">Si pagó en bolívares, anota el equivalente en dólares.</p>
        </div>
        <div class="field">
          <label for="rp-method">Forma de pago</label>
          <app-select-menu id="rp-method" label="Forma de pago" placeholder="Elige cómo pagó" [options]="methods" [value]="method()" (picked)="pickMethod($event)" />
        </div>
        @if (method() !== 'cash') {
          <div class="field">
            <label for="rp-reference">Número de referencia</label>
            <input id="rp-reference" class="input" autocomplete="off" maxlength="40" [value]="reference()" (input)="reference.set(value($event))" />
          </div>
        }
        <div class="field">
          <label for="rp-date">Fecha del pago</label>
          <app-date-picker id="rp-date" label="Fecha del pago" [value]="paidOn()" [max]="today()" [todayIso]="today()" (picked)="paidOn.set($event)" />
        </div>
        <div class="field">
          <label>Comprobante <span class="opt">opcional</span></label>
          <app-file-drop [compact]="true" accept="image/png,image/jpeg,application/pdf" label="Arrastra la captura o haz clic para elegirla"
            [hint]="receipt() ?? 'Mientras los datos sean de ejemplo, el archivo no se sube.'" (picked)="receipt.set($event.name)" />
        </div>
      </div>
      <ng-container dialog-actions>
        <button type="button" class="btn" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="btn btn--primary" (click)="save()"><span>Guardar pago</span></button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    :host { --dialog-width: 460px; }
    .fields { display: flex; flex-direction: column; gap: 14px; }
    .opt { font-weight: 400; color: var(--color-text-muted); }
  `,
})
export class RegisterPaymentDialog {
  private readonly store = inject(SubscriptionsStore);

  readonly open = input(false);
  /** The company, when the dialog opens from its own page. */
  readonly subscriptionId = input<Id | null>(null);
  readonly closed = output<void>();
  /** The company whose payment was saved. */
  readonly saved = output<Id>();

  protected readonly methods: MenuOption[] = (Object.entries(PAYMENT_METHOD_LABEL) as [PaymentMethod, string][]).map(([value, label]) => ({ value, label }));
  protected readonly companies = computed<MenuOption[]>(() =>
    this.store.subscriptions().filter((s) => s.plan !== 'internal').map((s) => ({ value: s.id, label: s.companyName })),
  );
  protected readonly today = signal(this.store.today());

  protected readonly companyId = signal<Id | null>(null);
  protected readonly amount = signal('');
  protected readonly method = signal<PaymentMethod | null>(null);
  protected readonly reference = signal('');
  protected readonly paidOn = signal<string | null>(null);
  protected readonly receipt = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  /** «Debe noviembre: 39,00 $», under the company. */
  protected readonly owed = computed(() => {
    const sub = this.companyId() ? this.store.byId().get(this.companyId()!) : null;
    if (!sub) return null;
    return `Paga ${monthTitle(monthOf(sub.nextChargeOn)).toLowerCase()}: ${formatUsdCents(this.store.terms(sub.plan).priceCents)}.`;
  });

  constructor() {
    // Each time it opens: a clean form, the company already chosen when it comes from its page.
    effect(() => {
      if (!this.open()) return;
      const id = this.subscriptionId();
      untracked(() => {
        this.today.set(this.store.today());
        this.reference.set('');
        this.method.set(null);
        this.paidOn.set(this.today());
        this.receipt.set(null);
        this.error.set(null);
        this.pickCompany(id ?? '');
      });
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** Choosing the company fills in its monthly fee, which is what it usually pays. */
  protected pickCompany(id: string): void {
    const sub = id ? this.store.byId().get(id) : undefined;
    this.companyId.set(sub ? id : null);
    this.amount.set(sub ? formatUsdCents(this.store.terms(sub.plan).priceCents).replace(' $', '') : '');
  }

  protected pickMethod(value: string): void {
    this.method.set(value in PAYMENT_METHOD_LABEL ? (value as PaymentMethod) : null);
  }

  protected save(): void {
    const companyId = this.companyId();
    const cents = parsePriceCents(this.amount());
    const method = this.method();
    const paidOn = this.paidOn();
    const reference = this.reference().trim();
    const problem = !companyId
      ? 'Elige la empresa que pagó.'
      : !cents
        ? 'Escribe el monto que pagó, mayor que cero.'
        : !method
          ? 'Elige la forma de pago.'
          : method !== 'cash' && !reference
            ? 'Escribe el número de referencia del pago.'
            : !paidOn
              ? 'Elige la fecha del pago.'
              : null;
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.store.registerPayment(companyId!, { amountCents: cents!, method: method!, reference: method === 'cash' ? '' : reference, paidOn: paidOn!, receiptName: this.receipt() });
    this.saved.emit(companyId!);
  }
}
