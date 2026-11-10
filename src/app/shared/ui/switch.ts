import { Component, input, output } from '@angular/core';

/** On/off toggle with the ARIA switch role (mockup web-14: 44x24, brand colour when on). */
@Component({
  selector: 'app-switch',
  template: `
    <button type="button" role="switch" [attr.aria-checked]="checked()" [attr.aria-label]="label()" [attr.aria-busy]="busy()"
      [disabled]="disabled() || busy()" [class.on]="checked()" (click)="toggled.emit(!checked())"><i></i></button>
  `,
  styles: `
    :host { display: inline-flex; }
    button { width: 44px; height: 24px; border-radius: 99px; border: 1px solid var(--color-border-strong); background: var(--color-surface-hover);
      position: relative; cursor: pointer; padding: 0; flex: none; transition: background-color 0.15s, border-color 0.15s; }
    button.on { background: var(--color-primary); border-color: var(--color-primary); }
    button:focus-visible { outline: 0; box-shadow: 0 0 0 4px var(--color-ring); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button[aria-busy='true'] { opacity: 0.7; cursor: progress; }
    i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: var(--shadow); transition: left 0.15s; }
    button.on i { left: 22px; }
  `,
})
export class Switch {
  readonly checked = input(false);
  readonly label = input.required<string>();
  readonly disabled = input(false);
  /** Saving the change: the switch waits, dimmed, and takes no clicks. */
  readonly busy = input(false);
  readonly toggled = output<boolean>();
}
