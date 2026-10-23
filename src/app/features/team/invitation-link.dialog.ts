import { Component, input, output, signal } from '@angular/core';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';

/**
 * Shows an invitation link once, right after it is created or renewed: the server keeps only
 * a fingerprint of it, so this is the moment to copy it and send it to the person.
 */
@Component({
  selector: 'app-invitation-link-dialog',
  imports: [Dialog, Icon],
  template: `
    <app-dialog title="Enlace de invitación" [open]="!!link()" (closed)="closed.emit()">
      <p class="lead">Envíale este enlace a <b>{{ name() }}</b> por WhatsApp o por correo. Con él crea su contraseña y entra.</p>
      <div class="copy">
        <input class="input mono" aria-label="Enlace de invitación" readonly [value]="link()" (focus)="select($event)" />
        <button type="button" class="btn btn--primary" (click)="copy()">
          <app-icon [name]="copied() ? 'check' : 'copy'" />{{ copied() ? 'Copiado' : 'Copiar' }}
        </button>
      </div>
      <p class="field-hint">Sirve una sola vez y vence en 72 horas. Si se pierde, genera uno nuevo desde la lista de invitaciones: el anterior deja de funcionar.</p>
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
  `,
})
export class InvitationLinkDialog {
  readonly link = input<string | null>(null);
  readonly name = input('');
  readonly closed = output<void>();

  protected readonly copied = signal(false);

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
