import { Component, effect, input, output, signal, untracked } from '@angular/core';
import type { Id } from '../../shared/api/models';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { AccessFields } from './access-fields';
import type { MemberAccess } from './team-remote';
import type { TeamMemberRow } from './team.actions';

/** Role, numbers and "sees others" of one person, changed only with «Guardar». */
@Component({
  selector: 'app-member-access-dialog',
  imports: [AccessFields, Dialog, Icon],
  template: `
    <app-dialog [title]="'Acceso de ' + (member()?.user?.name ?? '')" [open]="!!member()" (closed)="close()">
      <app-access-fields [access]="access()" (changed)="access.set($event)" />
      @if (error(); as message) { <p class="field-error" role="alert">{{ message }}</p> }
      <div dialog-actions class="dialog-actions">
        <button type="button" class="btn" [disabled]="saving()" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn--primary" [disabled]="saving()" [attr.aria-busy]="saving()" (click)="save()">
          @if (saving()) { <span class="spinner" aria-hidden="true"></span> } @else { <app-icon name="check" /> }
          Guardar
        </button>
      </div>
    </app-dialog>
  `,
  styles: '.field-error { margin-top: 12px; }',
})
export class MemberAccessDialog {
  readonly member = input<TeamMemberRow | null>(null);
  /** Runs the change; resolves to the reason it was refused, or null when saved. */
  readonly submit = input.required<(userId: Id, access: MemberAccess) => Promise<string | null>>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly access = signal<MemberAccess>({ role: 'agent', canSeeOthers: false, channelAccountIds: [] });
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      const membership = this.member()?.membership;
      if (!membership) return;
      untracked(() => {
        this.access.set({ role: membership.role, canSeeOthers: membership.canSeeOthers, channelAccountIds: [...membership.channelAccountIds] });
        this.error.set(null);
      });
    });
  }

  protected async save(): Promise<void> {
    const member = this.member();
    if (!member || this.saving()) return;
    this.saving.set(true);
    const error = await this.submit()(member.user.id, this.access());
    this.saving.set(false);
    if (error) return this.error.set(error);
    this.saved.emit();
  }

  protected close(): void {
    if (!this.saving()) this.closed.emit();
  }
}
