import { Component, ElementRef, afterRenderEffect, inject, input, output, signal, viewChild } from '@angular/core';
import type { Message } from '../../../shared/api/models';
import { Icon } from '../../../shared/ui/icon';
import { MediaLoader } from './media-loader';

/**
 * A photo of the chat, large (mockup web-24, step 2): who sent it and when, «Descargar» and the ✕.
 * It closes with the ✕, with Esc or by clicking outside the photo. Built on the native <dialog>:
 * focus stays inside and the page behind is inert.
 */
@Component({
  selector: 'app-media-viewer',
  imports: [Icon],
  template: `
    <dialog #dialog aria-label="Foto" (close)="closed.emit()" (click)="onBackdrop($event)">
      <header>
        <div class="who"><b>{{ sender() }}</b><small>{{ when() }}</small></div>
        <button type="button" class="btn-dark" [attr.aria-busy]="saving()" [disabled]="saving()" (click)="download()"><app-icon name="download" /><span>Descargar</span></button>
        <button type="button" class="btn-dark icon" aria-label="Cerrar" (click)="dialog.close()"><app-icon name="x" /></button>
      </header>
      <div class="stage">
        @if (url(); as src) {
          <img [src]="src" alt="Foto enviada en la conversación" />
        } @else if (failed()) {
          <p class="note">No se pudo cargar la foto.</p>
        } @else {
          <p class="note">Cargando foto…</p>
        }
      </div>
      @if (message().body) {
        <p class="caption">{{ message().body }}</p>
      }
    </dialog>
  `,
  styles: `
    dialog { width: 100vw; height: 100dvh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: rgba(10, 12, 20, 0.94); color: #fff; }
    dialog[open] { display: flex; flex-direction: column; }
    dialog::backdrop { background: transparent; }
    header { display: flex; align-items: center; gap: 10px; padding: 14px 18px; }
    .who { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .who b { font-size: 14px; } .who small { font-size: 12px; color: #cbd5e1; }
    .btn-dark { display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(255, 255, 255, 0.25); background: transparent; color: #fff; border-radius: var(--radius-md); padding: 8px 12px; font-size: 13px; font-weight: 600; cursor: pointer; --icon-size: 16px; }
    .btn-dark:hover { background: rgba(255, 255, 255, 0.1); }
    .btn-dark.icon { padding: 8px; }
    .stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 0 16px; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; }
    .note { color: #cbd5e1; font-size: 14px; }
    .caption { text-align: center; font-size: 14px; color: #e5e7eb; padding: 12px 16px 20px; white-space: pre-wrap; }
  `,
})
export class MediaViewer {
  private readonly loader = inject(MediaLoader);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly message = input.required<Message>();
  /** Who sent it: the customer's name, «Desde el teléfono» or the agent. */
  readonly sender = input('');
  readonly when = input('');
  readonly closed = output<void>();

  protected readonly url = signal<string | null>(null);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);

  constructor() {
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      if (!dialog.open) dialog.showModal();
    });
    afterRenderEffect(() => {
      const message = this.message();
      this.loader.url(message, 'full').then(
        (url) => this.url.set(url),
        () => this.failed.set(true),
      );
    });
  }

  /** A click on the dark area (the dialog itself, not its content) closes it. */
  protected onBackdrop(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target === this.dialog().nativeElement || target.classList.contains('stage')) this.dialog().nativeElement.close();
  }

  protected async download(): Promise<void> {
    this.saving.set(true);
    try {
      const blob = await this.loader.blob(this.message(), 'full');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `foto-${this.message().id}.webp`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
    } catch {
      this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
