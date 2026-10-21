import { Component, inject, signal } from '@angular/core';
import { Workspace } from '../../core/workspace';
import { TONES } from '../../shared/api/labels';
import type { Tag, Tone } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { ContactsData } from '../contacts/contacts.data';
import { SettingsActions } from './settings.actions';
import { nameError } from './settings.rules';

@Component({
  selector: 'app-tags-settings',
  imports: [Icon, Pill],
  template: `
    <section class="card box">
      <h2>Etiquetas</h2>
      <p class="field-hint">Sirven para agrupar contactos y filtrar la bandeja.</p>
      <div class="rows">
        @for (tag of workspace.tags(); track tag.id) {
          <div class="row">
            <app-pill [tone]="tag.tone">{{ tag.name }}</app-pill>
            <input class="input grow" [attr.aria-label]="'Nombre de ' + tag.name" [value]="tag.name" (change)="rename(tag, $event)" />
            <select class="select" [attr.aria-label]="'Color de ' + tag.name" (change)="setTone(tag, $event)">
              @for (tone of tones; track tone.id) {
                <option [value]="tone.id" [selected]="tone.id === tag.tone">{{ tone.text }}</option>
              }
            </select>
            <span class="count">{{ usage(tag.id) }} contactos</span>
            @if (confirming() === tag.id) {
              <button type="button" class="link danger" (click)="remove(tag)">Sí, borrar</button>
              <button type="button" class="link" (click)="confirming.set(null)">No</button>
            } @else {
              <button type="button" class="link danger" (click)="confirming.set(tag.id)">Borrar</button>
            }
          </div>
        }
      </div>
      <div class="add-row">
        <input class="input grow" placeholder="Nueva etiqueta" aria-label="Nueva etiqueta" [value]="newName()" (input)="newName.set(value($event))" />
        <select class="select" aria-label="Color de la nueva etiqueta" (change)="newTone.set($any(value($event)))">
          @for (tone of tones; track tone.id) {
            <option [value]="tone.id" [selected]="tone.id === newTone()">{{ tone.text }}</option>
          }
        </select>
        <button type="button" class="btn" (click)="add()"><app-icon name="plus" />Agregar</button>
      </div>
    </section>
  `,
  styleUrl: './settings-section.scss',
})
export class TagsSettings {
  protected readonly workspace = inject(Workspace);
  private readonly contacts = inject(ContactsData);
  private readonly actions = inject(SettingsActions);
  private readonly toaster = inject(Toaster);

  protected readonly tones = TONES;
  protected readonly newName = signal('');
  protected readonly newTone = signal<Tone>('blue');
  protected readonly confirming = signal<string | null>(null);

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected usage(tagId: string): number {
    return this.contacts.all().filter((c) => c.tagIds.includes(tagId)).length;
  }

  protected rename(tag: Tag, event: Event): void {
    const input = event.target as HTMLInputElement;
    const error = nameError(input.value, this.workspace.tags().filter((t) => t.id !== tag.id).map((t) => t.name));
    if (error) {
      this.toaster.show(error, 'info');
      input.value = tag.name;
      return;
    }
    void this.actions.updateTag(tag.id, { name: input.value.trim() }).then((ok) => ok || (input.value = tag.name));
  }

  protected setTone(tag: Tag, event: Event): void {
    void this.actions.updateTag(tag.id, { tone: this.value(event) as Tone });
  }

  protected async add(): Promise<void> {
    const error = nameError(this.newName(), this.workspace.tags().map((t) => t.name));
    if (error) return this.toaster.show(error, 'info');
    if (await this.actions.addTag(this.newName(), this.newTone())) this.newName.set('');
  }

  protected async remove(tag: Tag): Promise<void> {
    const ok = await this.actions.removeTag(tag.id);
    this.confirming.set(null);
    if (ok) this.toaster.show(`Etiqueta «${tag.name}» borrada`);
  }
}
