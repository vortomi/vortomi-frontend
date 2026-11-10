import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { Icon } from './icon';

/**
 * Our own file field, in place of the browser's <input type="file"> look: a box to drop the file
 * on or click to choose it. The native input stays inside (hidden) for the file dialog and keyboard.
 * `compact` is the one-line button form (logos, receipts).
 */
@Component({
  selector: 'app-file-drop',
  imports: [Icon],
  template: `
    <label class="drop" [class.over]="over()" [class.compact]="compact()" [class.disabled]="disabled() || busy()" [attr.aria-busy]="busy()"
      (dragover)="onDrag($event, true)" (dragleave)="over.set(false)" (drop)="onDrop($event)">
      <input #file type="file" class="visually-hidden" [accept]="accept()" [disabled]="disabled() || busy()" (change)="onPick($event)" />
      @if (busy()) {
        <span class="spinner"></span>
      } @else {
        <app-icon name="upload" />
      }
      <span class="text">
        <b>{{ label() }}</b>
        @if (hint() && !compact()) { <small>{{ hint() }}</small> }
      </span>
    </label>
  `,
  styles: `
    .drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 22px 16px; text-align: center;
      border: 2px dashed var(--color-border-strong); border-radius: var(--radius-lg); background: var(--color-surface-muted); color: var(--color-text-muted);
      cursor: pointer; --icon-size: 26px; transition: border-color 0.15s, background-color 0.15s; }
    .drop:hover, .drop.over { border-color: var(--color-primary); background: var(--color-primary-softer); }
    .drop:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 4px var(--color-ring); }
    .text { display: flex; flex-direction: column; gap: 2px; }
    b { color: var(--color-text); font-size: 14px; font-weight: 600; }
    small { font-size: 12.5px; }
    .drop.compact { flex-direction: row; display: inline-flex; padding: 0 14px; height: 40px; border-width: 1px; border-style: solid;
      border-color: var(--color-border); background: var(--color-surface); border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); --icon-size: 16px; }
    .drop.compact b { font-weight: 500; color: var(--color-text-2); }
    .drop.disabled { opacity: 0.6; cursor: not-allowed; }
    .spinner { color: var(--color-primary); }
  `,
})
export class FileDrop {
  readonly label = input('Arrastra el archivo aquí o haz clic para elegirlo');
  readonly hint = input('');
  /** Same as the input's accept: "image/png,image/jpeg", ".csv"… */
  readonly accept = input('');
  readonly compact = input(false);
  readonly disabled = input(false);
  /** Uploading: a circle instead of the icon, and no new picks. */
  readonly busy = input(false);
  readonly picked = output<File>();

  protected readonly over = signal(false);
  private readonly file = viewChild.required<ElementRef<HTMLInputElement>>('file');

  protected onDrag(event: DragEvent, over: boolean): void {
    event.preventDefault();
    if (!this.disabled() && !this.busy()) this.over.set(over);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && !this.disabled() && !this.busy()) this.picked.emit(file);
  }

  protected onPick(event: Event): void {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];
    if (file) this.picked.emit(file);
    // The same file can be picked again after an error.
    this.file().nativeElement.value = '';
  }
}
