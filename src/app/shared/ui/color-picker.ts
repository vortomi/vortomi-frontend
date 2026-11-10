import { Component, input, output } from '@angular/core';
import { Icon } from './icon';

/** Colours offered for stages, numbers and labels: readable on white and on the dark surfaces. */
export const PALETTE = ['#3b4fd8', '#1c64f2', '#0e9f6e', '#057a55', '#c27803', '#e8743b', '#e02424', '#d61f69', '#7e3af2', '#0694a2', '#6b7280', '#111827'];

/** Our own colour field, in place of <input type="color">: a row of swatches; the chosen one is ticked. */
@Component({
  selector: 'app-color-picker',
  imports: [Icon],
  template: `
    <div class="swatches" role="radiogroup" [attr.aria-label]="label()">
      @for (color of colors(); track color) {
        <button type="button" role="radio" [attr.aria-checked]="same(color)" [attr.aria-label]="color" [class.on]="same(color)"
          [style.background]="color" (click)="picked.emit(color)">
          @if (same(color)) { <app-icon name="check" [stroke]="3" /> }
        </button>
      }
    </div>
  `,
  styles: `
    .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
    button { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--color-surface); box-shadow: 0 0 0 1px var(--color-border-strong);
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #fff; --icon-size: 15px; }
    button.on { box-shadow: 0 0 0 2px var(--color-primary); }
    button:focus-visible { outline: 0; box-shadow: 0 0 0 4px var(--color-ring); }
  `,
})
export class ColorPicker {
  readonly value = input<string | null>(null);
  readonly label = input('Color');
  /** The swatches; a saved colour that is not among them is added, so it still shows as chosen. */
  readonly palette = input<readonly string[]>(PALETTE);
  readonly picked = output<string>();

  protected colors(): readonly string[] {
    const current = this.value();
    return current && !this.palette().some((c) => this.equal(c, current)) ? [...this.palette(), current] : this.palette();
  }

  protected same(color: string): boolean {
    return !!this.value() && this.equal(color, this.value()!);
  }

  private equal(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
  }
}
