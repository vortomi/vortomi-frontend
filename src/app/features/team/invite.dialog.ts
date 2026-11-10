import { Component, inject, input, output, signal } from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { Dialog } from '../../shared/ui/dialog';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { AccessFields } from './access-fields';
import type { MemberAccess } from './team-remote';
import { TeamActions } from './team.actions';

interface InviteModel {
  name: string;
  email: string;
}

/** A new person starts as an agent who only sees what is assigned to them and what nobody attends. */
const NEW_ACCESS: MemberAccess = { role: 'agent', canSeeOthers: false, channelAccountIds: [] };

@Component({
  selector: 'app-invite-dialog',
  imports: [FormField, AccessFields, Dialog, FieldError, Icon],
  template: `
    <app-dialog title="Invitar persona" [open]="open()" (closed)="close()">
      <form id="invite-form" class="form" (submit)="send($event)" novalidate>
        @if (error(); as message) {
          <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
        }
        <div class="field">
          <label for="inv-name">Nombre</label>
          <input id="inv-name" class="input" [formField]="inviteForm.name" />
          <app-field-error [state]="inviteForm.name()" />
        </div>
        <div class="field">
          <label for="inv-email">Correo</label>
          <input id="inv-email" class="input" type="email" [formField]="inviteForm.email" />
          <app-field-error [state]="inviteForm.email()" />
        </div>
        <app-access-fields [access]="access()" (changed)="access.set($event)" />
        <p class="field-hint">Se crea un enlace de un solo uso que vence en 72 horas. Se lo envías, y con él la persona crea su contraseña.</p>
      </form>
      <div dialog-actions class="dialog-actions">
        <button type="button" class="btn" [disabled]="inviteForm().submitting()" (click)="close()"><span>Cancelar</span></button>
        <button type="submit" form="invite-form" class="btn btn--primary" [disabled]="inviteForm().submitting()" [attr.aria-busy]="inviteForm().submitting()">
          <span>Crear invitación</span>
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: 14px; }
  `,
})
export class InviteDialog {
  private readonly team = inject(TeamActions);
  readonly open = input(false);
  readonly closed = output<void>();
  /** The link to hand over, shown once by the page (InvitationLinkDialog). */
  readonly created = output<{ link: string; name: string }>();

  protected readonly error = signal<string | null>(null);
  protected readonly access = signal<MemberAccess>(NEW_ACCESS);
  private readonly model = signal<InviteModel>({ name: '', email: '' });
  protected readonly inviteForm = form(this.model, (path) => {
    required(path.name, { message: 'Escribe su nombre.' });
    required(path.email, { message: 'Escribe su correo.' });
    email(path.email, { message: 'Ese correo no parece válido.' });
  });

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.inviteForm, async () => {
      const value = this.model();
      const access = this.access();
      const result = await this.team.invite({
        ...value,
        ...access,
      });
      if ('error' in result) {
        this.error.set(result.error);
        return undefined;
      }
      this.created.emit({ link: result.link, name: value.name.trim() });
      this.close();
      return undefined;
    });
  }

  protected close(): void {
    this.error.set(null);
    this.access.set(NEW_ACCESS);
    this.inviteForm().reset({ name: '', email: '' });
    this.closed.emit();
  }
}
