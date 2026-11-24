import { Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { Dialog } from './dialog';
import { Icon } from './icon';

/**
 * A private file shown over the page (mockup web-42, «Ver comprobante»): an image as it is, a PDF in
 * its own viewer, with «Descargar» and «Cerrar». The file is fetched with the session (it is never a
 * public link) and its address lives only while the window is open.
 */
@Component({
  selector: 'app-file-viewer-dialog',
  imports: [Dialog, Icon],
  template: `
    <app-dialog [open]="open()" [title]="title()" (closed)="closed.emit()">
      <div class="frame">
        @if (failed()) {
          <p class="empty"><app-icon name="alert" />No pudimos abrir el archivo.</p>
        } @else if (!url()) {
          <p class="empty">Cargando…</p>
        } @else if (isPdf()) {
          <iframe [src]="safeUrl()" [title]="title()"></iframe>
        } @else {
          <img [src]="url()" [alt]="title()" />
        }
      </div>
      <ng-container dialog-actions>
        @if (url()) { <a class="btn" [href]="url()" [attr.download]="fileName()">Descargar</a> }
        <button type="button" class="btn btn--primary" (click)="closed.emit()">Cerrar</button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    :host { --dialog-width: 760px; }
    .frame { min-height: 280px; max-height: calc(100dvh - 240px); display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md);
      background: var(--color-surface-hover); overflow: auto; }
    img { display: block; max-width: 100%; max-height: calc(100dvh - 260px); object-fit: contain; }
    iframe { width: 100%; height: calc(100dvh - 260px); border: 0; background: #fff; }
    .empty { display: flex; align-items: center; gap: 8px; color: var(--color-text-muted); font-size: 14px; }
  `,
})
export class FileViewerDialog {
  readonly open = input(false);
  readonly title = input('Comprobante');
  /** Fetches the file (with the session). */
  readonly load = input.required<() => Promise<Blob>>();
  readonly fileName = input('comprobante');
  readonly closed = output<void>();

  private readonly sanitizer = inject(DomSanitizer);
  protected readonly url = signal<string | null>(null);
  protected readonly safeUrl = signal<SafeResourceUrl | null>(null);
  protected readonly isPdf = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => (open ? void this.fetch() : this.release()));
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private async fetch(): Promise<void> {
    this.release();
    this.failed.set(false);
    try {
      const blob = await this.load()();
      const url = URL.createObjectURL(blob);
      this.isPdf.set(blob.type === 'application/pdf');
      // A blob: address made here from our own API's bytes, never one from outside.
      this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      this.url.set(url);
    } catch {
      this.failed.set(true);
    }
  }

  private release(): void {
    const url = this.url();
    if (url) URL.revokeObjectURL(url);
    this.url.set(null);
    this.safeUrl.set(null);
  }
}
