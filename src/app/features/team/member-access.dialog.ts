import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Workspace } from '../../core/workspace';
import type { Id, TenantRole } from '../../shared/api/models';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import type { MemberAccess } from './team-remote';
import type { TeamMemberRow } from './team.actions';

/** Role, numbers and "sees others" of one person, changed only with «Guardar». */
@Component({
  selector: 'app-member-access-dialog',
  imports: [Dialog, Icon],
  template: `
    <app-dialog [title]="'Acceso de ' + (member()?.user?.name ?? '')" [open]="!!member()" (closed)="close()">
      <div class="field">
        <label for="acc-role">Rol</label>
        <select id="acc-role" class="input" (change)="setRole($event)">
          <option value="agent" [selected]="access().role === 'agent'">Agente: atiende los números que le asignes</option>
          <option value="admin" [selected]="access().role === 'admin'">Administración: ve todo y maneja el equipo</option>
        </select>
      </div>
      @if (access().role === 'agent') {
        <fieldset class="field">
          <legend class="label">Números que atiende</legend>
          @for (channel of workspace.channels(); track channel.id) {
            <label class="checkbox">
              <input type="checkbox" [checked]="access().channelAccountIds.includes(channel.id)" (change)="toggleChannel(channel.id)" />
              {{ channel.label }} · {{ channel.displayNumber }}
            </label>
          }
        </fieldset>
        <label class="checkbox">
          <input type="checkbox" [checked]="access().canSeeOthers" (change)="patch({ canSeeOthers: !access().canSeeOthers })" />
          Puede ver las conversaciones asignadas a otras personas
        </label>
      } @else {
        <p class="field-hint">Administración ve todos los números y todas las conversaciones.</p>
      }
      @if (error(); as message) { <p class="field-error" role="alert">{{ message }}</p> }
      <div dialog-actions>
        <button type="button" class="btn" [disabled]="saving()" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn--primary" [disabled]="saving()" [attr.aria-busy]="saving()" (click)="save()">
          @if (saving()) { <span class="spinner" aria-hidden="true"></span> } @else { <app-icon name="check" /> }
          Guardar
        </button>
      </div>
    </app-dialog>
  `,
  styles: 'fieldset { border: 0; display: flex; flex-direction: column; gap: 8px; }',
})
export class MemberAccessDialog {
  protected readonly workspace = inject(Workspace);

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

  protected patch(change: Partial<MemberAccess>): void {
    this.access.update((a) => ({ ...a, ...change }));
  }

  protected setRole(event: Event): void {
    this.patch({ role: (event.target as HTMLSelectElement).value as TenantRole });
  }

  protected toggleChannel(id: Id): void {
    const ids = this.access().channelAccountIds;
    this.patch({ channelAccountIds: ids.includes(id) ? ids.filter((c) => c !== id) : [...ids, id] });
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
