import { Component, input, output } from '@angular/core';

/** On/off toggle with the ARIA switch role. */
@Component({
  selector: 'app-switch',
  template: `
    <button type="button" role="switch" [attr.aria-checked]="checked()" [attr.aria-label]="label()" [disabled]="disabled()"
      [class.on]="checked()" (click)="toggled.emit(!checked())"><i></i></button>
  `,
  styles: `
    button { width: 36px; height: 21px; border-radius: 99px; border: 0; background: #c9ced6; position: relative; cursor: pointer; padding: 0; }
    button.on { background: var(--color-success); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    i { position: absolute; top: 3px; left: 3px; width: 15px; height: 15px; border-radius: 50%; background: #fff; transition: left 0.15s; }
    button.on i { left: 18px; }
  `,
})
export class Switch {
  readonly checked = input(false);
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly toggled = output<boolean>();
}
