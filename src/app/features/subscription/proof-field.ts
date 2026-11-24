import { Component, input, output, signal } from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { MAX_PROOF_BYTES, PROOF_TYPES } from './payment-forms';

/** A receipt chosen: what the form checks, and its bytes as base64 for the server. */
export interface ChosenProof {
  name: string;
  size: number;
  mimeType: string;
  data: string;
}

const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** The file's bytes as base64 (without the «data:…;base64,» head). */
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * «Comprobante» of a payment report (mockup web-40): always there, required or optional as the
 * method says. An image or a PDF of up to 5 MB, dropped or looked for; the form checks the type and
 * size (and the server, the bytes). A file too big is not even read.
 */
@Component({
  selector: 'app-proof-field',
  imports: [Icon],
  template: `
    <label class="lbl" [attr.for]="inputId">Comprobante @if (!required()) { <em>(opcional)</em> } <em>· imagen o PDF, hasta 5 MB</em></label>
    <input [id]="inputId" #picker type="file" class="hidden" [accept]="accept" (change)="onPicked($event)" />
    @if (chosen(); as file) {
      <div class="file" [class.err]="invalid()">
        <app-icon name="file" />
        <span class="name">{{ file.name }} · {{ size(file.size) }}</span>
        <button type="button" class="link" (click)="picker.click()">Cambiar</button>
        <button type="button" class="icon-btn" aria-label="Quitar el comprobante" (click)="clear(picker)"><app-icon name="x" /></button>
      </div>
    } @else {
      <button type="button" class="drop" [class.over]="over()" [class.err]="invalid()" (click)="picker.click()" (dragover)="onDrag($event, true)" (dragleave)="over.set(false)"
        (drop)="onDrop($event)">
        <app-icon name="upload" />
        @if (kept()) { <span>Se queda el comprobante que enviaste. <b>Cambiarlo</b></span> } @else { <span>Arrastra tu comprobante o <b>búscalo</b></span> }
      </button>
    }
  `,
  styles: `
    :host { display: block; }
    .lbl { display: block; font-size: 13px; font-weight: 600; color: var(--color-text-2); margin-bottom: 6px; }
    .lbl em { font-style: normal; font-weight: 400; color: var(--color-text-muted); }
    .hidden { display: none; }
    .drop { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border: 1.5px dashed var(--color-border-strong);
      border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text-muted); font: inherit; font-size: 13px; cursor: pointer; --icon-size: 18px; }
    .drop b { color: var(--color-primary-text); }
    .drop.over, .drop:hover { border-color: var(--color-primary); background: var(--color-primary-softer); }
    .file { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid color-mix(in srgb, var(--color-success) 45%, transparent);
      border-radius: var(--radius-md); background: var(--color-success-soft); color: var(--color-success-text); font-size: 13px; --icon-size: 16px; }
    .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .link { border: 0; background: none; padding: 0; font: inherit; font-weight: 600; color: var(--color-primary-text); cursor: pointer; }
    .icon-btn { color: inherit; }
    .drop.err, .file.err { border-color: var(--color-danger); background: var(--color-danger-soft); color: var(--color-danger-text); }
  `,
})
export class ProofField {
  /** The method asks for it. */
  readonly required = input(false);
  /** A corrected payment keeps the receipt it was sent with. */
  readonly kept = input(false);
  readonly invalid = input(false);
  readonly changed = output<ChosenProof | null>();

  private static nextId = 0;
  protected readonly inputId = `proof-${ProofField.nextId++}`;
  protected readonly accept = PROOF_TYPES.join(',');
  protected readonly chosen = signal<ChosenProof | null>(null);
  protected readonly over = signal(false);

  protected size(bytes: number): string {
    return sizeText(bytes);
  }

  protected onPicked(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) void this.take(file);
  }

  protected onDrag(event: DragEvent, over: boolean): void {
    event.preventDefault();
    this.over.set(over);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) void this.take(file);
  }

  protected clear(picker: HTMLInputElement): void {
    picker.value = '';
    this.chosen.set(null);
    this.changed.emit(null);
  }

  private async take(file: File): Promise<void> {
    // A file too big or of another type is shown (the form says why) but never read.
    const valid = file.size <= MAX_PROOF_BYTES && (PROOF_TYPES as readonly string[]).includes(file.type);
    const proof = { name: file.name, size: file.size, mimeType: file.type, data: valid ? await readBase64(file) : '' };
    this.chosen.set(proof);
    this.changed.emit(proof);
  }
}
