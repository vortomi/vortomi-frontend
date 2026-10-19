import { Component, Injectable, inject, signal } from '@angular/core';
import { Icon } from './icon';

interface Toast {
  id: number;
  text: string;
  tone: 'success' | 'info';
}

const TOAST_MS = 3500;

/** Short confirmations after an action ("Invitación reenviada"). */
@Injectable({ providedIn: 'root' })
export class Toaster {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(text: string, tone: Toast['tone'] = 'success'): void {
    const toast = { id: this.nextId++, text, tone };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), TOAST_MS);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}

@Component({
  selector: 'app-toast-host',
  imports: [Icon],
  template: `
    @for (toast of toaster.toasts(); track toast.id) {
      <div class="toast" [class]="toast.tone" role="status">
        <app-icon [name]="toast.tone === 'success' ? 'check' : 'alert'" />{{ toast.text }}
      </div>
    }
  `,
  styles: `
    :host { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column;
      gap: 8px; z-index: 100; pointer-events: none; }
    .toast { display: flex; align-items: center; gap: 9px; background: #17202e; color: #fff; padding: 11px 16px;
      border-radius: var(--radius-md); font-size: 13.5px; box-shadow: var(--shadow-pop); --icon-size: 17px; }
    .toast.success app-icon { color: #4ade80; }
    .toast.info app-icon { color: #fbbf24; }
  `,
})
export class ToastHost {
  protected readonly toaster = inject(Toaster);
}
