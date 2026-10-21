import { Component, inject, signal } from '@angular/core';
import { Workspace } from '../../core/workspace';
import type { PipelineStage } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { ContactsData } from '../contacts/contacts.data';
import { SettingsActions } from './settings.actions';
import { nameError, stageDeleteError } from './settings.rules';

@Component({
  selector: 'app-stages-settings',
  imports: [Icon],
  template: `
    <section class="card box">
      <h2>Etapas del pipeline</h2>
      <p class="field-hint">El recorrido de una venta, de izquierda a derecha. Se usan en la ficha del cliente y en el pipeline.</p>
      <div class="rows">
        @for (stage of workspace.stages(); track stage.id; let first = $first, last = $last) {
          <div class="row">
            <button type="button" class="icon-btn" [disabled]="first" [attr.aria-label]="'Subir ' + stage.name" (click)="actions.moveStage(stage.id, -1)">
              <app-icon name="down" class="up" />
            </button>
            <button type="button" class="icon-btn" [disabled]="last" [attr.aria-label]="'Bajar ' + stage.name" (click)="actions.moveStage(stage.id, 1)">
              <app-icon name="down" />
            </button>
            <input type="color" class="color" [attr.aria-label]="'Color de ' + stage.name" [value]="stage.color" (change)="setColor(stage, $event)" />
            <input class="input grow" [attr.aria-label]="'Nombre de ' + stage.name" [value]="stage.name" (change)="rename(stage, $event)" />
            <span class="count">{{ usage(stage.id) }} contactos</span>
            <button type="button" class="link danger" (click)="remove(stage)">Borrar</button>
          </div>
        }
      </div>
      <div class="add-row">
        <input type="color" class="color" aria-label="Color de la nueva etapa" [value]="newColor()" (change)="newColor.set(value($event))" />
        <input class="input grow" placeholder="Nueva etapa" aria-label="Nueva etapa" [value]="newName()" (input)="newName.set(value($event))" />
        <button type="button" class="btn" (click)="add()"><app-icon name="plus" />Agregar</button>
      </div>
    </section>
  `,
  styleUrl: './settings-section.scss',
  styles: '.up { transform: rotate(180deg); }',
})
export class StagesSettings {
  protected readonly workspace = inject(Workspace);
  protected readonly actions = inject(SettingsActions);
  private readonly contacts = inject(ContactsData);
  private readonly toaster = inject(Toaster);

  protected readonly newName = signal('');
  protected readonly newColor = signal('#3b4fd8');

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected usage(stageId: string): number {
    return this.contacts.all().filter((c) => c.stageId === stageId).length;
  }

  protected rename(stage: PipelineStage, event: Event): void {
    const input = event.target as HTMLInputElement;
    const error = nameError(input.value, this.workspace.stages().filter((s) => s.id !== stage.id).map((s) => s.name));
    if (error) {
      this.toaster.show(error, 'info');
      input.value = stage.name;
      return;
    }
    void this.actions.updateStage(stage.id, { name: input.value.trim() }).then((ok) => ok || (input.value = stage.name));
  }

  protected setColor(stage: PipelineStage, event: Event): void {
    void this.actions.updateStage(stage.id, { color: this.value(event) });
  }

  protected async add(): Promise<void> {
    const error = nameError(this.newName(), this.workspace.stages().map((s) => s.name));
    if (error) return this.toaster.show(error, 'info');
    if (await this.actions.addStage(this.newName(), this.newColor())) this.newName.set('');
  }

  protected async remove(stage: PipelineStage): Promise<void> {
    const error = stageDeleteError(this.usage(stage.id));
    if (error) return this.toaster.show(error, 'info');
    if (await this.actions.removeStage(stage.id)) this.toaster.show(`Etapa «${stage.name}» borrada`);
  }
}
