import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { toApiFailure } from '../../core/api/api-error';
import { Dialog } from './dialog';
import { Icon, type IconName } from './icon';

export interface ConfirmRequest {
  title: string;
  message: string;
  /** Text of the button that goes ahead ("Borrar", "Salir sin guardar"). */
  confirmLabel: string;
  /** Red button: the action destroys or discards something. */
  danger?: boolean;
  /** Text of the button that backs out; "Cancelar" when left out. */
  cancelLabel?: string;
  /**
   * The work to do once the person says yes. While it runs the dialog stays open with the circle on
   * the button; if it fails, the error is shown inside the dialog and nothing closes. Left out, the
   * dialog closes at once and the caller does the work.
   */
  action?: () => Promise<unknown>;
}

interface Pending extends ConfirmRequest {
  resolve: (answer: boolean) => void;
}

/**
 * Asks the person before something that cannot be undone, with the panel's own dialog
 * instead of the browser's. One question at a time; closing the dialog means "no".
 * Resolves true when the person said yes (and, with an action, when the action succeeded).
 */
@Injectable({ providedIn: 'root' })
export class Confirm {
  readonly pending = signal<Pending | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  ask(request: ConfirmRequest): Promise<boolean> {
    // A question still open is answered "no" before the new one replaces it.
    if (!this.busy()) this.pending()?.resolve(false);
    this.error.set(null);
    return new Promise((resolve) => this.pending.set({ ...request, resolve }));
  }

  async answer(value: boolean): Promise<void> {
    const current = this.pending();
    if (!current || this.busy()) return;
    if (value && current.action) {
      this.busy.set(true);
      this.error.set(null);
      try {
        await current.action();
      } catch (error) {
        this.error.set(toApiFailure(error).message);
        return;
      } finally {
        this.busy.set(false);
      }
    }
    this.pending.set(null);
    current.resolve(value);
  }
}

@Component({
  selector: 'app-confirm-host',
  imports: [Dialog, Icon],
  template: `
    @let request = confirm.pending();
    <app-dialog [open]="!!request" [title]="request?.title ?? ''" [centered]="true" [locked]="confirm.busy()" (closed)="confirm.answer(false)">
      <span class="mark" [class.danger]="request?.danger" dialog-icon><app-icon [name]="icon()" /></span>
      <p class="message">{{ request?.message }}</p>
      @if (confirm.error(); as error) {
        <p class="form-alert" role="alert"><app-icon name="alert" />{{ error }}</p>
      }
      <ng-container dialog-actions>
        <button type="button" class="btn" [disabled]="confirm.busy()" (click)="confirm.answer(false)">{{ request?.cancelLabel ?? 'Cancelar' }}</button>
        <button type="button" class="btn" [class.btn--danger]="request?.danger" [class.btn--primary]="!request?.danger"
          [attr.aria-busy]="confirm.busy()" (click)="confirm.answer(true)">
          <span>{{ request?.confirmLabel }}</span>
        </button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    .mark { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: var(--color-primary-soft); color: var(--color-primary-text); --icon-size: 24px; }
    .mark.danger { background: var(--color-danger-soft); color: var(--color-danger); }
    .message { font-size: 14px; line-height: 1.55; color: var(--color-text-muted); text-align: center; }
    .form-alert { text-align: left; }
  `,
})
export class ConfirmHost {
  protected readonly confirm = inject(Confirm);
  protected readonly icon = computed<IconName>(() => (this.confirm.pending()?.danger ? 'alert' : 'check'));
}
