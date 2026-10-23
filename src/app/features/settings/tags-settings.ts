import { Component, inject, signal } from '@angular/core';
import { Workspace } from '../../core/workspace';
import { TONES } from '../../shared/api/labels';
import type { Id, Tag, Tone } from '../../shared/api/models';
import { Confirm } from '../../shared/ui/confirm';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { ContactsData } from '../contacts/contacts.data';
import { SettingsActions } from './settings.actions';
import { nameError } from './settings.rules';

interface TagForm {
  id: Id | null;
  name: string;
  tone: Tone;
}

@Component({
  selector: 'app-tags-settings',
  imports: [Dialog, Icon, Pill],
  template: `
    <section class="card box">
      <div class="section-head">
        <div>
          <h2>Etiquetas</h2>
          <p class="field-hint">Sirven para agrupar contactos y filtrar la bandeja.</p>
        </div>
        <button type="button" class="btn btn--primary" (click)="openNew()"><app-icon name="plus" />Nueva etiqueta</button>
      </div>
      <div class="rows">
        @for (tag of workspace.tags(); track tag.id) {
          <div class="row">
            <app-pill [tone]="tag.tone">{{ tag.name }}</app-pill>
            <span class="count">{{ usage(tag.id) }} contactos</span>
            <span class="row-actions">
              <button type="button" class="link" (click)="openEdit(tag)">Editar</button>
              <button type="button" class="link danger" (click)="remove(tag)">Borrar</button>
            </span>
          </div>
        } @empty {
          <p class="empty">Todavía no hay etiquetas. Crea la primera con «Nueva etiqueta».</p>
        }
      </div>
    </section>

    <app-dialog [open]="!!form()" [title]="form()?.id ? 'Editar etiqueta' : 'Nueva etiqueta'" (closed)="close()">
      @if (form(); as f) {
        <div class="field">
          <label for="tag-name">Nombre</label>
          <input id="tag-name" class="input" maxlength="40" [value]="f.name" (input)="set('name', $event)" />
        </div>
        <div class="field">
          <label for="tag-tone">Color</label>
          <select id="tag-tone" class="input" (change)="set('tone', $event)">
            @for (tone of tones; track tone.id) {
              <option [value]="tone.id" [selected]="tone.id === f.tone">{{ tone.text }}</option>
            }
          </select>
        </div>
        <div class="preview">Así se verá: <app-pill [tone]="f.tone">{{ f.name || 'Etiqueta' }}</app-pill></div>
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
})
export class TagsSettings {
  protected readonly workspace = inject(Workspace);
  private readonly contacts = inject(ContactsData);
  private readonly actions = inject(SettingsActions);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly tones = TONES;
  protected readonly form = signal<TagForm | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected usage(tagId: Id): number {
    return this.contacts.all().filter((c) => c.tagIds.includes(tagId)).length;
  }

  protected openNew(): void {
    this.open({ id: null, name: '', tone: 'blue' });
  }

  protected openEdit(tag: Tag): void {
    this.open({ id: tag.id, name: tag.name, tone: tag.tone });
  }

  protected set(key: 'name' | 'tone', event: Event): void {
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
    const error = nameError(f.name, this.workspace.tags().filter((t) => t.id !== f.id).map((t) => t.name));
    if (error) return this.error.set(error);
    this.saving.set(true);
    const name = f.name.trim();
    const ok = f.id ? await this.actions.updateTag(f.id, { name, tone: f.tone }) : await this.actions.addTag(name, f.tone);
    this.saving.set(false);
    if (!ok) return;
    this.form.set(null);
    this.toaster.show(f.id ? `Etiqueta «${name}» guardada` : `Etiqueta «${name}» creada`);
  }

  protected async remove(tag: Tag): Promise<void> {
    const count = this.usage(tag.id);
    const yes = await this.confirm.ask({
      title: `¿Borrar «${tag.name}»?`,
      message: count ? `Se quitará de ${count} contactos. No se puede deshacer.` : 'No la tiene ningún contacto. No se puede deshacer.',
      confirmLabel: 'Borrar etiqueta',
      danger: true,
    });
    if (yes && (await this.actions.removeTag(tag.id))) this.toaster.show(`Etiqueta «${tag.name}» borrada`);
  }

  private open(form: TagForm): void {
    this.error.set(null);
    this.form.set(form);
  }
}
