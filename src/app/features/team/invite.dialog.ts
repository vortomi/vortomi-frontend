import { Component, inject, input, output, signal } from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { Workspace } from '../../core/workspace';
import type { Id, TenantRole } from '../../shared/api/models';
import { Dialog } from '../../shared/ui/dialog';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { TeamActions } from './team.actions';

interface InviteModel {
  name: string;
  email: string;
  role: TenantRole;
  canSeeOthers: boolean;
}

@Component({
  selector: 'app-invite-dialog',
  imports: [FormField, Dialog, FieldError, Icon],
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
        <div class="field">
          <label for="inv-role">Rol</label>
          <select id="inv-role" class="input" [formField]="inviteForm.role">
            <option value="agent">Agente: atiende los números que le asignes</option>
            <option value="admin">Administración: ve todo e invita al equipo</option>
          </select>
        </div>
        @if (inviteForm.role().value() === 'agent') {
          <fieldset class="field">
            <legend class="label">Números que atiende</legend>
            @for (channel of workspace.channels(); track channel.id) {
              <label class="checkbox">
                <input type="checkbox" [checked]="channels().includes(channel.id)" (change)="toggleChannel(channel.id)" />
                {{ channel.label }} · {{ channel.displayNumber }}
              </label>
            }
          </fieldset>
          <label class="checkbox"><input type="checkbox" [formField]="inviteForm.canSeeOthers" />Puede ver las conversaciones asignadas a otras personas</label>
        }
        <p class="field-hint">Se crea un enlace de un solo uso que vence en 72 horas. Se lo envías, y con él la persona crea su contraseña.</p>
      </form>
      <div dialog-actions class="dialog-actions">
        <button type="button" class="btn" (click)="close()">Cancelar</button>
        <button type="submit" form="invite-form" class="btn btn--primary" [disabled]="inviteForm().submitting()" [attr.aria-busy]="inviteForm().submitting()">
          @if (inviteForm().submitting()) { <span class="spinner" aria-hidden="true"></span> }
          Crear invitación
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: 12px; }
    fieldset { border: 0; display: flex; flex-direction: column; gap: 8px; }
  `,
})
export class InviteDialog {
  protected readonly workspace = inject(Workspace);
  private readonly team = inject(TeamActions);
  readonly open = input(false);
  readonly closed = output<void>();
  /** The link to hand over, shown once by the page (InvitationLinkDialog). */
  readonly created = output<{ link: string; name: string }>();

  protected readonly error = signal<string | null>(null);
  protected readonly channels = signal<Id[]>([]);
  private readonly model = signal<InviteModel>({ name: '', email: '', role: 'agent', canSeeOthers: false });
  protected readonly inviteForm = form(this.model, (path) => {
    required(path.name, { message: 'Escribe su nombre.' });
    required(path.email, { message: 'Escribe su correo.' });
    email(path.email, { message: 'Ese correo no parece válido.' });
  });

  protected toggleChannel(id: Id): void {
    this.channels.update((list) => (list.includes(id) ? list.filter((c) => c !== id) : [...list, id]));
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.inviteForm, async () => {
      const value = this.model();
      const allChannels = this.workspace.channels().map((c) => c.id);
      const result = await this.team.invite({
        ...value,
        channelAccountIds: value.role === 'admin' ? allChannels : this.channels(),
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
    this.channels.set([]);
    this.inviteForm().reset({ name: '', email: '', role: 'agent', canSeeOthers: false });
    this.closed.emit();
  }
}
