import { Component, effect, input, output, signal, untracked } from '@angular/core';
import type { PaymentRejectionReason, ReviewDetail } from '../../../shared/api/subscriptions';
import { Dialog } from '../../../shared/ui/dialog';
import { Icon } from '../../../shared/ui/icon';
import { type MenuOption, SelectMenu } from '../../../shared/ui/select-menu';
import { REJECTION_REASONS } from './review.rules';

const REASON_OPTIONS: MenuOption[] = REJECTION_REASONS.map((r) => ({ value: r.value, label: r.label }));

/**
 * «Rechazar el pago» (mockup web-41, frame 4): a reason from the list and, if useful, a few words
 * for the company. It reads them and corrects the payment.
 */
@Component({
  selector: 'app-reject-payment-dialog',
  imports: [Dialog, Icon, SelectMenu],
  template: `
    <app-dialog [open]="open()" [title]="'Rechazar el pago de ' + detail().tenantName" [locked]="busy()" (closed)="closed.emit()">
      <div class="field">
        <label>Motivo</label>
        <app-select-menu label="Motivo" placeholder="Elige el motivo" [options]="reasons" [value]="reason()" (picked)="reason.set(asReason($event))" />
      </div>
      <div class="field">
        <label for="reject-note">Explícale qué pasó <em>(opcional)</em></label>
        <textarea id="reject-note" class="input" rows="3" maxlength="300" placeholder="No aparece ningún pago con esa referencia. Revisa el número."
          [value]="note()" (input)="note.set(value($event))"></textarea>
      </div>
      <p class="note"><app-icon name="info" />La empresa verá el motivo y podrá corregir el pago y volver a enviarlo. Si ya pasó su fecha, se suspende en ese momento.</p>
      @if (error(); as message) { <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div> }
      <ng-container dialog-actions>
        <button type="button" class="btn" [disabled]="busy()" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="btn btn--danger" [disabled]="busy() || !reason()" [attr.aria-busy]="busy()" (click)="confirm()">Rechazar pago</button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    :host { --dialog-width: 480px; }
    label em { font-style: normal; font-weight: 400; color: var(--color-text-muted); }
    textarea { resize: vertical; min-height: 72px; }
    .note { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; line-height: 1.5; color: var(--color-text-muted); --icon-size: 15px; }
    .note app-icon { flex: none; margin-top: 2px; }
  `,
})
export class RejectPaymentDialog {
  readonly open = input(false);
  readonly detail = input.required<ReviewDetail>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly rejected = output<{ reason: PaymentRejectionReason; note: string }>();

  protected readonly reasons = REASON_OPTIONS;
  protected readonly reason = signal<PaymentRejectionReason | null>(null);
  protected readonly note = signal('');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.reason.set(null);
        this.note.set('');
      });
    });
  }

  protected asReason(value: string): PaymentRejectionReason {
    return value as PaymentRejectionReason;
  }

  protected value(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected confirm(): void {
    const reason = this.reason();
    if (reason) this.rejected.emit({ reason, note: this.note().trim() });
  }
}
