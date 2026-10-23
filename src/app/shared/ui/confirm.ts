import { Component, Injectable, inject, signal } from '@angular/core';
import { Dialog } from './dialog';

export interface ConfirmRequest {
  title: string;
  message: string;
  /** Text of the button that goes ahead ("Borrar", "Salir sin guardar"). */
  confirmLabel: string;
  /** Red button: the action destroys or discards something. */
  danger?: boolean;
}

interface Pending extends ConfirmRequest {
  resolve: (answer: boolean) => void;
}

/**
 * Asks the person before something that cannot be undone, with the panel's own dialog
 * instead of the browser's. One question at a time; closing the dialog means "no".
 */
@Injectable({ providedIn: 'root' })
export class Confirm {
  readonly pending = signal<Pending | null>(null);

  ask(request: ConfirmRequest): Promise<boolean> {
    // A question still open is answered "no" before the new one replaces it.
    this.pending()?.resolve(false);
    return new Promise((resolve) => this.pending.set({ ...request, resolve }));
  }

  answer(value: boolean): void {
    const current = this.pending();
    if (!current) return;
    this.pending.set(null);
    current.resolve(value);
  }
}

@Component({
  selector: 'app-confirm-host',
  imports: [Dialog],
  template: `
    @let request = confirm.pending();
    <app-dialog [open]="!!request" [title]="request?.title ?? ''" (closed)="confirm.answer(false)">
      <p class="message">{{ request?.message }}</p>
      <ng-container dialog-actions>
        <button type="button" class="btn" (click)="confirm.answer(false)">Cancelar</button>
        <button type="button" class="btn" [class.btn--danger]="request?.danger" [class.btn--primary]="!request?.danger" (click)="confirm.answer(true)">
          {{ request?.confirmLabel }}
        </button>
      </ng-container>
    </app-dialog>
  `,
  styles: '.message { font-size: 14px; line-height: 1.5; color: var(--color-text-2); }',
})
export class ConfirmHost {
  protected readonly confirm = inject(Confirm);
}
