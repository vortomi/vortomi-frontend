import { Component, ElementRef, Renderer2, inject, signal } from '@angular/core';
import { Icon } from './icon';

/**
 * Wraps a password input and adds the eye that shows or hides what was typed:
 * `<app-password-field><input type="password" … /></app-password-field>`. The input keeps its
 * own bindings (formField, autocomplete); only its `type` changes while it is shown.
 */
@Component({
  selector: 'app-password-field',
  imports: [Icon],
  template: `
    <ng-content />
    <button type="button" class="eye" [attr.aria-label]="shown() ? 'Ocultar contraseña' : 'Mostrar contraseña'" [attr.aria-pressed]="shown()" (click)="toggle()">
      <app-icon [name]="shown() ? 'eye-off' : 'eye'" />
    </button>
  `,
  styles: `
    :host { position: relative; display: block; }
    :host ::ng-deep input { padding-right: 40px; width: 100%; }
    .eye { position: absolute; top: 50%; right: 6px; transform: translateY(-50%); width: 30px; height: 30px; border: 0; border-radius: 7px;
      background: none; color: var(--color-text-faint); cursor: pointer; display: flex; align-items: center; justify-content: center; --icon-size: 18px; }
    .eye:hover { color: var(--color-text-2); background: var(--color-surface-muted); }
    .eye:focus-visible { outline: 0; box-shadow: 0 0 0 3px var(--color-primary-soft); }
  `,
})
export class PasswordField {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  protected readonly shown = signal(false);

  protected toggle(): void {
    const input = this.host.nativeElement.querySelector('input');
    if (!input) return;
    this.shown.update((on) => !on);
    this.renderer.setAttribute(input, 'type', this.shown() ? 'text' : 'password');
    input.focus();
  }
}
