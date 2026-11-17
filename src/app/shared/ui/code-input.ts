import { Directive, ElementRef, inject } from '@angular/core';

/** Product codes are up to 40 characters (the server's rule, inventory.rules skuError). */
export const CODE_MAX = 40;

/**
 * A product code as it must be stored: upper case, digits and dashes, at most 40. Lower case is
 * written in upper case as it is typed; anything else is refused; what slips in is cleaned on blur.
 */
@Directive({
  selector: 'input[appCode]',
  host: { '(beforeinput)': 'guard($event)', '(blur)': 'tidy()', '[attr.maxlength]': 'max', autocapitalize: 'characters', spellcheck: 'false' },
})
export class CodeInput {
  protected readonly max = CODE_MAX;
  private readonly field = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  protected guard(event: InputEvent): void {
    if (!event.inputType.startsWith('insert')) return;
    const inserted = event.data ?? event.dataTransfer?.getData('text/plain');
    if (inserted === null || inserted === undefined) return;
    const { value } = this.field;
    const start = this.field.selectionStart ?? value.length;
    const end = this.field.selectionEnd ?? value.length;
    const upper = inserted.toUpperCase();
    const room = CODE_MAX - (value.length - (end - start));
    if (!/^[A-Z0-9-]*$/.test(upper) || upper.length > room) {
      event.preventDefault();
      return;
    }
    if (upper === inserted) return;
    // Lower case: written as upper case right away, and the form told as if typed.
    event.preventDefault();
    this.field.setRangeText(upper, start, end, 'end');
    this.field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  protected tidy(): void {
    const cleaned = cleanCode(this.field.value);
    if (cleaned === this.field.value) return;
    this.field.value = cleaned;
    this.field.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/** «n-jam-01ffff…» → «N-JAM-01FFFF…» cut at 40, without spaces or signs. */
export function cleanCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, CODE_MAX);
}
