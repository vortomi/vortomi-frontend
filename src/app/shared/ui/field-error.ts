import { Component, computed, input } from '@angular/core';
import type { ReadonlyFieldState } from '@angular/forms/signals';

/** First validation message of a field, once the person has touched it or tried to submit. */
@Component({
  selector: 'app-field-error',
  template: `
    @if (message(); as text) {
      <p class="field-error" role="alert">{{ text }}</p>
    }
  `,
})
export class FieldError {
  readonly state = input.required<ReadonlyFieldState<unknown>>();

  protected readonly message = computed(() => {
    const state = this.state();
    return state.touched() ? (state.errors()[0]?.message ?? null) : null;
  });
}
