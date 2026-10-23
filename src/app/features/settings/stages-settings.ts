import { Component, inject, signal } from '@angular/core';
import { Workspace } from '../../core/workspace';
import type { Id, PipelineStage } from '../../shared/api/models';
import { Confirm } from '../../shared/ui/confirm';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { ContactsData } from '../contacts/contacts.data';
import { SettingsActions } from './settings.actions';
import { nameError, stageDeleteError } from './settings.rules';

interface StageForm {
  id: Id | null;
  name: string;
  color: string;
}

@Component({
  selector: 'app-stages-settings',
  imports: [Dialog, Icon],
  template: `
    <section class="card box">
      <div class="section-head">
        <div>
          <h2>Etapas del pipeline</h2>
          <p class="field-hint">El recorrido de una venta, de izquierda a derecha. Se usan en la ficha del cliente y en el pipeline.</p>
        </div>
        <button type="button" class="btn btn--primary" (click)="openNew()"><app-icon name="plus" />Nueva etapa</button>
      </div>
      <div class="rows">
        @for (stage of workspace.stages(); track stage.id; let first = $first, last = $last) {
          <div class="row">
            <button type="button" class="icon-btn" [disabled]="first || moving()" [attr.aria-label]="'Subir ' + stage.name" (click)="move(stage, -1)">
              <app-icon name="down" class="up" />
            </button>
            <button type="button" class="icon-btn" [disabled]="last || moving()" [attr.aria-label]="'Bajar ' + stage.name" (click)="move(stage, 1)">
              <app-icon name="down" />
            </button>
            <span class="swatch" [style.background]="stage.color" aria-hidden="true"></span>
            <span class="name">{{ stage.name }}</span>
            <span class="count">{{ usage(stage.id) }} contactos</span>
            <span class="row-actions">
              <button type="button" class="link" (click)="openEdit(stage)">Editar</button>
              <button type="button" class="link danger" (click)="remove(stage)">Borrar</button>
            </span>
          </div>
        } @empty {
          <p class="empty">Todavía no hay etapas. Crea la primera con «Nueva etapa».</p>
        }
      </div>
    </section>

    <app-dialog [open]="!!form()" [title]="form()?.id ? 'Editar etapa' : 'Nueva etapa'" (closed)="close()">
      @if (form(); as f) {
        <div class="field">
          <label for="stage-name">Nombre</label>
          <input id="stage-name" class="input" maxlength="40" [value]="f.name" (input)="set('name', $event)" />
        </div>
        <div class="field">
          <label for="stage-color">Color</label>
          <input id="stage-color" type="color" class="color" [value]="f.color" (input)="set('color', $event)" />
        </div>
        @if (error(); as message) { <p class="field-error" role="alert">{{ message }}</p> }
      }
      <ng-container dialog-actions>
        <button type="button" class="btn" [disabled]="saving()" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn--primary" [disabled]="saving()" [attr.aria-busy]="saving()" (click)="save()">
          @if (saving()) { <span class="spinner" aria-hidden="true"></span> } @else { <app-icon name="check" /> }
          Guardar
        </button>
      </ng-container>
    </app-dialog>
  `,
  styleUrl: '../../shared/ui/section.scss',
  styles: '.up { transform: rotate(180deg); }',
})
export class StagesSettings {
  protected readonly workspace = inject(Workspace);
  private readonly actions = inject(SettingsActions);
  private readonly contacts = inject(ContactsData);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly form = signal<StageForm | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly moving = signal(false);

  protected usage(stageId: Id): number {
    return this.contacts.all().filter((c) => c.stageId === stageId).length;
  }

  protected openNew(): void {
    this.open({ id: null, name: '', color: '#3b4fd8' });
  }

  protected openEdit(stage: PipelineStage): void {
    this.open({ id: stage.id, name: stage.name, color: stage.color });
  }

  protected set(key: 'name' | 'color', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.form.update((f) => (f ? { ...f, [key]: value } : f));
    this.error.set(null);
  }

  protected close(): void {
    if (!this.saving()) this.form.set(null);
  }

  protected async save(): Promise<void> {
    const f = this.form();
    if (!f || this.saving()) return;
    const error = nameError(f.name, this.workspace.stages().filter((s) => s.id !== f.id).map((s) => s.name));
    if (error) return this.error.set(error);
    this.saving.set(true);
    const name = f.name.trim();
    const ok = f.id ? await this.actions.updateStage(f.id, { name, color: f.color }) : await this.actions.addStage(name, f.color);
    this.saving.set(false);
    if (!ok) return;
    this.form.set(null);
    this.toaster.show(f.id ? `Etapa «${name}» guardada` : `Etapa «${name}» creada`);
  }

  /** An explicit button, saved at once: the toast says so. */
  protected async move(stage: PipelineStage, direction: -1 | 1): Promise<void> {
    this.moving.set(true);
    const ok = await this.actions.moveStage(stage.id, direction);
    this.moving.set(false);
    if (ok) this.toaster.show('Orden guardado');
  }

  protected async remove(stage: PipelineStage): Promise<void> {
    const blocked = stageDeleteError(this.usage(stage.id));
    if (blocked) return this.toaster.show(blocked, 'info');
    const yes = await this.confirm.ask({
      title: `¿Borrar «${stage.name}»?`,
      message: 'Ningún contacto está en esta etapa. No se puede deshacer.',
      confirmLabel: 'Borrar etapa',
      danger: true,
    });
    if (yes && (await this.actions.removeStage(stage.id))) this.toaster.show(`Etapa «${stage.name}» borrada`);
  }

  private open(form: StageForm): void {
    this.error.set(null);
    this.form.set(form);
  }
}
