import { DestroyRef, Injectable, type Signal, computed, inject, signal } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { Confirm } from './confirm';

/**
 * Forms with changes not saved yet. A form registers its "dirty" signal; leaving the page,
 * switching tabs or closing the browser then asks before throwing the changes away.
 */
@Injectable({ providedIn: 'root' })
export class UnsavedChanges {
  private readonly confirm = inject(Confirm);
  private readonly forms = signal<Signal<boolean>[]>([]);

  readonly any = computed(() => this.forms().some((dirty) => dirty()));

  constructor() {
    // The browser shows its own fixed text here; it only lets us ask for it.
    window.addEventListener('beforeunload', (event) => {
      if (this.any()) event.preventDefault();
    });
  }

  /** Call in an injection context: the form stops counting when its component is destroyed. */
  track(dirty: Signal<boolean>): void {
    this.forms.update((list) => [...list, dirty]);
    inject(DestroyRef).onDestroy(() => this.forms.update((list) => list.filter((d) => d !== dirty)));
  }

  /** True when there is nothing to lose, or the person chose to discard it. */
  async mayLeave(): Promise<boolean> {
    if (!this.any()) return true;
    return this.confirm.ask({
      title: 'Tienes cambios sin guardar',
      message: 'Si sales ahora, se pierden. Para conservarlos, vuelve y pulsa «Guardar».',
      confirmLabel: 'Salir sin guardar',
      danger: true,
    });
  }
}

/** Route guard: asks before leaving a page with unsaved changes. */
export const unsavedChangesGuard: CanDeactivateFn<unknown> = () => inject(UnsavedChanges).mayLeave();
