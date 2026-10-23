import { Component, ElementRef, afterRenderEffect, input, output, viewChild } from '@angular/core';
import { Icon } from './icon';

/**
 * Modal built on the native <dialog>: focus trap, Escape to close and inert background come
 * from the browser, so it is accessible without extra code.
 */
@Component({
  selector: 'app-dialog',
  imports: [Icon],
  template: `
    <dialog #dialog [attr.aria-labelledby]="titleId" (close)="closed.emit()">
      <header>
        <h2 [id]="titleId">{{ title() }}</h2>
        <button type="button" class="x" (click)="dialog.close()" aria-label="Cerrar"><app-icon name="x" /></button>
      </header>
      <div class="body"><ng-content /></div>
      <footer><ng-content select="[dialog-actions]" /></footer>
    </dialog>
  `,
  styles: `
    /* margin: auto centres it; the global reset (styles.scss) would otherwise pin it to a corner. */
    dialog { margin: auto; border: 0; border-radius: var(--radius-lg); padding: 0; width: min(var(--dialog-width, 520px), calc(100vw - 32px));
      max-height: calc(100dvh - 48px); box-shadow: 0 24px 60px rgba(20, 30, 50, 0.3); color: var(--color-text); }
    dialog::backdrop { background: rgba(15, 19, 32, 0.45); }
    header { display: flex; align-items: center; padding: 16px 20px 0; }
    h2 { font-size: 17px; flex: 1; }
    .x { border: 0; background: none; cursor: pointer; color: var(--color-text-muted); --icon-size: 18px; display: inline-flex; }
    .body { padding: 14px 20px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; max-height: calc(100dvh - 190px); }
    footer { display: flex; justify-content: flex-end; gap: 10px; padding: 0 20px 18px; }
    footer:empty { display: none; }
  `,
})
export class Dialog {
  readonly open = input(false);
  readonly title = input('');
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
}
