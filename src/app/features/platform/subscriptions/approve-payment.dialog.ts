import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import type { ReviewDetail } from '../../../shared/api/subscriptions';
import { Dialog } from '../../../shared/ui/dialog';
import { Icon } from '../../../shared/ui/icon';
import { parseTypedAmount } from '../../subscription/payment-forms';
import { approvalSteps } from './review.rules';

const plain = (amount: number) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

/**
 * «Aprobar el pago» (mockup web-41, frame 3): the amount that really arrived (what was reported,
 * unless something else came) and, before confirming, what approving does: the charge, the billing
 * day, the next due day, the balance in favour and the receipt.
 */
@Component({
  selector: 'app-approve-payment-dialog',
  imports: [Dialog, Icon],
  template: `
    <app-dialog [open]="open()" [title]="'Aprobar el pago de ' + detail().tenantName" [locked]="busy()" (closed)="closed.emit()">
      <div class="field" [class.has-error]="!!invalid()">
        <label for="received">Monto que llegó ({{ detail().currency === 'VES' ? 'Bs' : '$' }})</label>
        <input id="received" class="input" inputmode="decimal" autocomplete="off" [value]="typed()" (input)="typed.set(value($event))" />
        @if (invalid()) { <p class="field-error">Escribe un monto mayor que 0, con hasta 2 decimales.</p> }
        @else { <p class="field-hint">Si llegó otro monto, escríbelo: se aprueba por lo que llegó.</p> }
      </div>
      <ul class="steps">
        @for (step of steps(); track $index) { <li><app-icon name="check" />{{ step }}</li> }
      </ul>
      @if (error(); as message) { <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div> }
      <ng-container dialog-actions>
        <button type="button" class="btn" [disabled]="busy()" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="btn btn--primary" [disabled]="busy() || !!invalid()" [attr.aria-busy]="busy()" (click)="confirm()">Aprobar pago</button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    :host { --dialog-width: 480px; }
    .steps { list-style: none; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-surface-muted); font-size: 13px; line-height: 1.45; }
    .steps li { display: flex; gap: 8px; align-items: flex-start; --icon-size: 15px; }
    .steps app-icon { color: var(--color-success); margin-top: 2px; flex: none; }
  `,
})
export class ApprovePaymentDialog {
  readonly open = input(false);
  readonly detail = input.required<ReviewDetail>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  /** The amount that arrived, as the server takes it ("1234.56"), or null when it is what was reported. */
  readonly approved = output<string | null>();

  protected readonly typed = signal('');
  protected readonly parsed = computed(() => parseTypedAmount(this.typed()));
  protected readonly invalid = computed(() => this.parsed() === null);
  protected readonly steps = computed(() => {
    const d = this.detail();
    const amount = this.parsed() ?? d.amount;
    const cents = d.currency === 'USD' ? Math.round(Number(amount) * 100) : Math.round((Number(amount) / Number(d.payment.bsPerUsd ?? '1')) * 100);
    return approvalSteps(d, cents);
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const amount = this.detail().amount;
      untracked(() => this.typed.set(plain(Number(amount))));
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected confirm(): void {
    const parsed = this.parsed();
    if (!parsed) return;
    this.approved.emit(Number(parsed) === Number(this.detail().amount) ? null : parsed);
  }
}
