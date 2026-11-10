import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** What the person chose: follow the system (default), or always light / dark. */
export type ThemeMode = 'system' | 'light' | 'dark';

/** Same key as the script in index.html, which applies the theme before Angular starts (no flash). */
export const THEME_KEY = 'vortomi-theme';

function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Light or dark look. The choice is kept in this browser (localStorage); "system" follows the
 * device and changes with it. The look itself is the `dark` class on <html> (styles/_tokens.scss).
 */
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

  readonly mode = signal<ThemeMode>(readMode());
  /** What is on screen right now. */
  readonly dark = signal(false);

  constructor() {
    const onSystemChange = () => this.apply();
    this.media?.addEventListener('change', onSystemChange);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('change', onSystemChange));
    this.apply();
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      if (mode === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, mode);
    } catch {
      // Storage blocked: the choice lasts until the page is reloaded.
    }
    this.apply();
  }

  private apply(): void {
    const mode = this.mode();
    const dark = mode === 'dark' || (mode === 'system' && !!this.media?.matches);
    this.dark.set(dark);
    this.root.classList.toggle('dark', dark);
  }
}
