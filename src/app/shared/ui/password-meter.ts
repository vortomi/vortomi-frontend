import { Component, computed, input } from '@angular/core';
import { MIN_PASSWORD_LENGTH, passwordStrength } from '../security/password-policy';

@Component({
  selector: 'app-password-meter',
  template: `
    <div class="bars" [attr.data-score]="strength().score" aria-hidden="true">
      @for (bar of bars; track bar) {
        <i [class.on]="bar < strength().score"></i>
      }
    </div>
    <p class="field-hint" aria-live="polite">
      @if (password()) {
        {{ strength().label }}.
      }
      Mínimo {{ min }} caracteres. Una frase larga es mejor que símbolos raros.
    </p>
  `,
  styles: `
    .bars { display: flex; gap: 5px; margin-top: 7px; }
    i { flex: 1; height: 5px; border-radius: 99px; background: #dfe3e9; }
    [data-score='1'] i.on { background: #e05d4f; }
    [data-score='2'] i.on { background: #e8a33b; }
    [data-score='3'] i.on, [data-score='4'] i.on { background: var(--color-success); }
  `,
})
export class PasswordMeter {
  readonly password = input.required<string>();
  protected readonly bars = [0, 1, 2, 3];
  protected readonly min = MIN_PASSWORD_LENGTH;
  protected readonly strength = computed(() => passwordStrength(this.password()));
}
