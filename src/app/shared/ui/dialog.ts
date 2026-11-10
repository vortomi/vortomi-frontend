import { Component, ElementRef, afterRenderEffect, input, output, viewChild } from '@angular/core';
import { Icon } from './icon';

/**
 * Modal built on the native <dialog>: focus trap, Escape to close and inert background come
 * from the browser, so it is accessible without extra code. `centered` is the confirmation
 * layout (icon, title and text in the middle, as in mockup web-16); put the icon in [dialog-icon].
 */
@Component({
  selector: 'app-dialog',
  imports: [Icon],
  template: `
    <dialog #dialog [attr.aria-labelledby]="titleId" [class.centered]="centered()" (close)="closed.emit()" (cancel)="onCancel($event)">
      <header>
        <ng-content select="[dialog-icon]" />
        <h2 [id]="titleId">{{ title() }}</h2>
        @if (!centered()) {
          <button type="button" class="x" (click)="dialog.close()" aria-label="Cerrar"><app-icon name="x" /></button>
        }
      </header>
      <div class="body"><ng-content /></div>
      <footer><ng-content select="[dialog-actions]" /></footer>
    </dialog>
  `,
  styles: `
    /* margin: auto centres it; the global reset (styles.scss) would otherwise pin it to a corner. */
    dialog { margin: auto; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 0;
      width: min(var(--dialog-width, 520px), calc(100vw - 32px)); max-height: calc(100dvh - 48px);
      box-shadow: var(--shadow-pop); color: var(--color-text); background: var(--color-surface); }
    dialog::backdrop { background: var(--color-backdrop); }
    dialog[open] { animation: pop 0.15s ease-out; }
    @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } }
    header { display: flex; align-items: center; gap: 12px; padding: 18px 22px 0; }
    h2 { font-size: 18px; font-weight: 600; flex: 1; }
    .x { border: 0; background: none; cursor: pointer; color: var(--color-text-faint); --icon-size: 18px; display: inline-flex;
      width: 32px; height: 32px; align-items: center; justify-content: center; border-radius: var(--radius-sm); }
    .x:hover { background: var(--color-surface-hover); color: var(--color-text); }
    .body { padding: 16px 22px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; max-height: calc(100dvh - 190px); }
    footer { display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: 6px 22px 20px; }
    footer:empty { display: none; }
    dialog.centered { --dialog-width: 460px; }
    dialog.centered header { flex-direction: column; padding: 26px 26px 0; gap: 14px; text-align: center; }
    dialog.centered .body { padding: 8px 26px 4px; align-items: stretch; }
    dialog.centered footer { justify-content: center; padding: 18px 26px 24px; }
  `,
})
export class Dialog {
  readonly open = input(false);
  readonly title = input('');
  /** Confirmation layout: icon, title and text centred, no close button. */
  readonly centered = input(false);
  /** While true, Escape does not close it (work in progress). */
  readonly locked = input(false);
  readonly closed = output<void>();

  private static nextId = 0;
  protected readonly titleId = `dialog-title-${Dialog.nextId++}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterRenderEffect(() => {
      const element = this.dialog().nativeElement;
      if (this.open() && !element.open) element.showModal();
      if (!this.open() && element.open) element.close();
    });
  }

  protected onCancel(event: Event): void {
    if (this.locked()) event.preventDefault();
  }
}
