import { Component, Injectable, inject, signal } from '@angular/core';
import { Icon } from './icon';

interface Toast {
  id: number;
  text: string;
  /** success: it worked. info: something to look at (a problem or a warning). */
  tone: 'success' | 'info';
}

const TOAST_MS = { success: 3500, info: 6000 };

/** Short confirmations after an action ("Invitación reenviada"). */
@Injectable({ providedIn: 'root' })
export class Toaster {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(text: string, tone: Toast['tone'] = 'success'): void {
    const toast = { id: this.nextId++, text, tone };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), TOAST_MS[tone]);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}

/** Top right, one under the other (mockup web-14); each closes by itself or with its ×. */
@Component({
  selector: 'app-toast-host',
  imports: [Icon],
  template: `
    @for (toast of toaster.toasts(); track toast.id) {
      <div class="toast" [class]="toast.tone" [attr.role]="toast.tone === 'info' ? 'alert' : 'status'">
        <span class="mark"><app-icon [name]="toast.tone === 'success' ? 'check' : 'alert'" /></span>
        <span class="text">{{ toast.text }}</span>
        <button type="button" class="x" aria-label="Cerrar aviso" (click)="toaster.dismiss(toast.id)"><app-icon name="x" /></button>
      </div>
    }
  `,
  styles: `
    :host { position: fixed; top: 18px; right: 18px; display: flex; flex-direction: column; gap: 10px; z-index: 1000; pointer-events: none;
      width: min(380px, calc(100vw - 36px)); }
    .toast { pointer-events: auto; display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 14px; border-radius: var(--radius-md);
      background: var(--color-surface); border: 1px solid var(--color-border); box-shadow: var(--shadow-pop); font-size: 14px;
      color: var(--color-text-2); line-height: 1.4; animation: slide 0.18s ease-out; }
    @keyframes slide { from { opacity: 0; transform: translateX(12px); } }
    .mark { width: 32px; height: 32px; border-radius: 8px; flex: none; display: flex; align-items: center; justify-content: center; --icon-size: 17px; }
    .success .mark { background: var(--color-success-soft); color: var(--color-success); }
    .info .mark { background: var(--color-warning-soft); color: var(--color-warning); }
    .text { flex: 1; }
    .x { border: 0; background: none; color: var(--color-text-faint); cursor: pointer; width: 28px; height: 28px; border-radius: 6px; flex: none;
      display: inline-flex; align-items: center; justify-content: center; --icon-size: 15px; }
    .x:hover { background: var(--color-surface-hover); color: var(--color-text); }
  `,
})
export class ToastHost {
  protected readonly toaster = inject(Toaster);
}
