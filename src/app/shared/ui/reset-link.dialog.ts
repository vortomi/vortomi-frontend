import { Component, computed, input, output, signal } from '@angular/core';
import { Dialog } from './dialog';
import { Icon } from './icon';

/** The page of a password link (mockup web-30), on the panel's own address. */
export const resetLinkOf = (token: string) => `${window.location.origin}/reset-password/${encodeURIComponent(token)}`;

/** WhatsApp with the message ready (wa.me, no number: the person picks the chat). */
export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/**
 * A password link, shown once right after it is given (mockup web-30): the server keeps only its
 * fingerprint. The old password already stopped working and the person's sessions were closed.
 */
@Component({
  selector: 'app-reset-link-dialog',
  imports: [Dialog, Icon],
  template: `
    <app-dialog [title]="'Enlace para ' + name()" [open]="!!link()" (closed)="closed.emit()">
      <p class="lead">Mándaselo por WhatsApp o en persona. Al abrirlo, {{ firstName() }} elige su contraseña nueva: <b>nadie más la conoce</b>, ni tú.</p>
      <div class="copy">
        <input class="input mono" aria-label="Enlace para elegir la contraseña" readonly [value]="link()" (focus)="select($event)" />
        <button type="button" class="btn" (click)="copy()">
          <app-icon [name]="copied() ? 'check' : 'copy'" />{{ copied() ? 'Copiado' : 'Copiar' }}
        </button>
      </div>
      <ul class="facts">
        <li><app-icon name="clock" /><span>Sirve <b>24 horas</b> y <b>una sola vez</b></span></li>
        <li><app-icon name="lock" /><span>Ya cerramos sus sesiones abiertas: su contraseña anterior ya no sirve</span></li>
        <li><app-icon name="eye" /><span>Solo se muestra ahora. Si se pierde, crea otro desde el menú ⋯</span></li>
      </ul>
      <a class="btn btn--block wa" [href]="whatsapp()" target="_blank" rel="noopener noreferrer"><span>Enviar por WhatsApp</span></a>
      <div dialog-actions>
        <button type="button" class="btn" (click)="closed.emit()">Listo</button>
      </div>
    </app-dialog>
  `,
  styles: `
    .lead { font-size: 14px; line-height: 1.5; }
    .copy { display: flex; gap: 8px; }
    .copy .input { flex: 1; min-width: 0; }
    .mono { font-family: var(--font-mono); font-size: 12.5px; }
    .facts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--color-text-2); }
    .facts li { display: flex; gap: 8px; align-items: flex-start; --icon-size: 14px; }
    .facts app-icon { margin-top: 2px; color: var(--color-text-muted); flex: none; }
    .wa { background: var(--color-whatsapp, #128c7e); border-color: transparent; color: #fff; }
  `,
})
export class ResetLinkDialog {
  readonly link = input<string | null>(null);
  readonly name = input('');
  readonly closed = output<void>();

  protected readonly copied = signal(false);
  protected readonly firstName = computed(() => this.name().split(' ')[0] || 'la persona');
  protected readonly whatsapp = computed(() =>
    whatsappShareUrl(`Hola ${this.firstName()}, con este enlace eliges tu contraseña nueva de Vortomi. Sirve 24 horas y una sola vez: ${this.link() ?? ''}`),
  );

  protected select(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected async copy(): Promise<void> {
    const link = this.link();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Without clipboard permission the field stays selectable for a manual copy.
      this.copied.set(false);
    }
  }
}
