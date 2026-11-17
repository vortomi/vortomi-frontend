import { Directive, ElementRef, inject, input } from '@angular/core';

/** Up to 9 whole digits: no price or quantity in Vortomi needs more. */
const MAX_WHOLE_DIGITS = 9;

/**
 * Prices and quantities as people type them: only digits and one decimal comma (or dot), never
 * letters, at most the decimals allowed. Wrong characters are refused while typing; whatever slips
 * in (a paste the browser does not describe) is cleaned when leaving the field. A price leaves the
 * field with its 2 decimals: «1» → «1,00».
 *
 * `appNumeric="money"`: 2 decimals, completed on blur. `appNumeric="quantity"`: `decimals` (0 for
 * products counted whole), `allowNegative` for stock adjustments.
 */
@Directive({
  selector: 'input[appNumeric]',
  host: { '(beforeinput)': 'guard($event)', '(blur)': 'tidy()' },
})
export class NumericInput {
  readonly appNumeric = input<'money' | 'quantity'>('money');
  readonly decimals = input(2);
  readonly allowNegative = input(false);

  private readonly field = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  private get places(): number {
    return this.appNumeric() === 'money' ? 2 : Math.max(0, this.decimals());
  }

  /** Whether `text` is a value being typed that may still become valid ("", "-", "1,", "1,5"). */
  allows(text: string): boolean {
    const sign = this.allowNegative() ? '-?' : '';
    const fraction = this.places > 0 ? `([.,]\\d{0,${this.places}})?` : '';
    return new RegExp(`^${sign}\\d{0,${MAX_WHOLE_DIGITS}}${fraction}$`).test(text);
  }

  protected guard(event: InputEvent): void {
    if (!event.inputType.startsWith('insert')) return;
    const inserted = event.data ?? event.dataTransfer?.getData('text/plain');
    // A paste the browser does not describe is cleaned on blur instead.
    if (inserted === null || inserted === undefined) return;
    const { value } = this.field;
    const start = this.field.selectionStart ?? value.length;
    const end = this.field.selectionEnd ?? value.length;
    if (!this.allows(value.slice(0, start) + inserted + value.slice(end))) event.preventDefault();
  }

  /** Leaves only a valid value in the field and tells the form, as if typed. */
  protected tidy(): void {
    const cleaned = clean(this.field.value, this.places, this.allowNegative(), this.appNumeric() === 'money');
    if (cleaned === this.field.value) return;
    this.field.value = cleaned;
    this.field.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/** «12safsadfasdf» → «12», «1,500000000» → «1,50», «1» → «1,00» (prices), «7,» → «7». */
export function clean(raw: string, places: number, allowNegative: boolean, pad: boolean): string {
  const negative = allowNegative && raw.trim().startsWith('-');
  const kept = raw.replace(/[^\d.,]/g, '');
  const separator = kept.search(/[.,]/);
  let whole = (separator < 0 ? kept : kept.slice(0, separator)).replace(/\D/g, '').slice(0, MAX_WHOLE_DIGITS);
  let fraction = separator < 0 || places === 0 ? '' : kept.slice(separator + 1).replace(/\D/g, '').slice(0, places);
  if (!whole && !fraction) return '';
  whole = whole.replace(/^0+(?=\d)/, '') || '0';
  if (pad) fraction = fraction.padEnd(places, '0');
  return `${negative ? '-' : ''}${whole}${fraction ? `,${fraction}` : ''}`;
}
