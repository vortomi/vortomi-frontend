import { Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { Theme, type ThemeMode } from '../../core/theme';
import { Icon, type IconName } from './icon';

const MODES: { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: 'system', label: 'Sistema', icon: 'monitor' },
  { mode: 'light', label: 'Claro', icon: 'sun' },
  { mode: 'dark', label: 'Oscuro', icon: 'moon' },
];

/** Light / dark button (mockup web-15): shows what is on screen; its menu offers System, Light and Dark. */
@Component({
  selector: 'app-theme-toggle',
  imports: [Icon],
  host: { '(document:click)': 'onOutside($event)', '(keydown.escape)': 'open.set(false)' },
  template: `
    <button type="button" class="btn btn--icon btn--sm" [attr.aria-expanded]="open()" aria-haspopup="menu"
      aria-label="Apariencia: claro u oscuro" (click)="open.set(!open())">
      <app-icon [name]="theme.dark() ? 'moon' : 'sun'" />
    </button>
    @if (open()) {
      <ul class="menu" role="menu" [class.up]="direction() === 'up'" [class.right]="align() === 'right'">
        @for (m of modes; track m.mode) {
          <li>
            <button type="button" role="menuitemradio" [attr.aria-checked]="m.mode === current()" [class.on]="m.mode === current()" (click)="choose(m.mode)">
              <app-icon [name]="m.icon" />{{ m.label }}
              @if (m.mode === current()) { <app-icon name="check" class="tick" /> }
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { position: relative; display: inline-flex; }
    .menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; width: 180px; list-style: none; padding: 6px;
      background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-pop); }
    .menu.right { left: auto; right: 0; }
    .menu.up { top: auto; bottom: calc(100% + 6px); }
    .menu button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 0; background: none;
      border-radius: 6px; font-size: 14px; color: var(--color-text-2); cursor: pointer; --icon-size: 16px; }
    .menu button:hover { background: var(--color-surface-hover); }
    .menu button.on { color: var(--color-primary-text); font-weight: 600; }
    .tick { margin-left: auto; }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(Theme);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Where the menu opens: below (default) or above the button (bottom of a sidebar). */
  readonly direction = input<'down' | 'up'>('down');
  /** Which edge of the button the menu lines up with. */
  readonly align = input<'left' | 'right'>('left');

  protected readonly modes = MODES;
  protected readonly open = signal(false);
  protected readonly current = computed(() => this.theme.mode());

  protected choose(mode: ThemeMode): void {
    this.theme.set(mode);
    this.open.set(false);
  }

  protected onOutside(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
