import { Component, inject, signal } from '@angular/core';
import { Workspace } from '../../core/workspace';
import type { Id, QuickReply } from '../../shared/api/models';
import { Confirm } from '../../shared/ui/confirm';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { SettingsActions } from './settings.actions';
import { shortcutError } from './settings.rules';

interface ReplyForm {
  id: Id | null;
  shortcut: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-quick-replies-settings',
  imports: [Dialog, Icon],
  template: `
    <section class="card box">
      <div class="section-head">
        <div>
          <h2>Respuestas rápidas</h2>
          <p class="field-hint">En la bandeja, escribe / y el atajo para insertarlas. Son de toda la empresa.</p>
        </div>
        <button type="button" class="btn btn--primary" (click)="openNew()"><app-icon name="plus" />Nueva respuesta</button>
      </div>
      <div class="rows">
        @for (reply of workspace.quickReplies(); track reply.id) {
          <div class="row reply">
            <div class="reply-text">
              <b><span class="slash">/{{ reply.shortcut }}</span> · {{ reply.title }}</b>
              <p>{{ reply.body }}</p>
            </div>
            <span class="row-actions">
              <button type="button" class="link" (click)="openEdit(reply)">Editar</button>
              <button type="button" class="link danger" (click)="remove(reply)">Borrar</button>
            </span>
          </div>
        } @empty {
          <p class="empty">Todavía no hay respuestas rápidas. Crea la primera con «Nueva respuesta».</p>
        }
      </div>
    </section>

    <app-dialog [open]="!!form()" [title]="form()?.id ? 'Editar respuesta rápida' : 'Nueva respuesta rápida'" (closed)="close()">
      @if (form(); as f) {
        <div class="field">
          <label for="reply-shortcut">Atajo</label>
          <div class="shortcut"><span class="slash">/</span><input id="reply-shortcut" class="input" maxlength="20" placeholder="pago" [value]="f.shortcut" (input)="set('shortcut', $event)" /></div>
          <p class="field-hint">De 2 a 20 caracteres: minúsculas, números, guion o guion bajo.</p>
        </div>
        <div class="field">
          <label for="reply-title">Título</label>
          <input id="reply-title" class="input" maxlength="80" placeholder="Datos de pago" [value]="f.title" (input)="set('title', $event)" />
        </div>
        <div class="field">
          <label for="reply-body">Texto que se inserta</label>
          <textarea id="reply-body" class="input" rows="4" maxlength="4096" [value]="f.body" (input)="set('body', $event)"></textarea>
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
  styles: `
    .reply { align-items: flex-start; flex-wrap: nowrap; }
    .reply-text { flex: 1; min-width: 0; }
    .reply-text b { font-size: 13.5px; font-weight: 600; }
    .reply-text p { font-size: 13px; color: var(--color-text-muted); margin-top: 3px; white-space: pre-wrap;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .slash { font-family: var(--font-mono); font-weight: 700; color: var(--color-primary-strong); }
    .shortcut { display: flex; gap: 6px; align-items: center; }
    .shortcut .input { font-family: var(--font-mono); }
  `,
})
export class QuickRepliesSettings {
  protected readonly workspace = inject(Workspace);
  private readonly actions = inject(SettingsActions);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly form = signal<ReplyForm | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected openNew(): void {
    this.open({ id: null, shortcut: '', title: '', body: '' });
  }

  protected openEdit(reply: QuickReply): void {
    this.open({ id: reply.id, shortcut: reply.shortcut, title: reply.title, body: reply.body });
  }

  protected set(key: 'shortcut' | 'title' | 'body', event: Event): void {
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
    const shortcut = f.shortcut.trim().replace(/^\//, '');
    const taken = this.workspace.quickReplies().filter((r) => r.id !== f.id).map((r) => r.shortcut);
    const error = shortcutError(shortcut, taken) ?? (!f.title.trim() || !f.body.trim() ? 'Escribe el título y el texto.' : null);
    if (error) return this.error.set(error);
    this.saving.set(true);
    const reply = { shortcut, title: f.title.trim(), body: f.body.trim() };
    const ok = f.id ? await this.actions.updateQuickReply(f.id, reply) : await this.actions.addQuickReply(reply);
    this.saving.set(false);
    if (!ok) return;
    this.form.set(null);
    this.toaster.show(f.id ? `Respuesta /${shortcut} guardada` : `Respuesta /${shortcut} creada`);
  }

  protected async remove(reply: QuickReply): Promise<void> {
    const yes = await this.confirm.ask({
      title: `¿Borrar /${reply.shortcut}?`,
      message: 'Nadie del equipo podrá insertarla más. No se puede deshacer.',
      confirmLabel: 'Borrar respuesta',
      danger: true,
    });
    if (yes && (await this.actions.removeQuickReply(reply.id))) this.toaster.show(`Respuesta /${reply.shortcut} borrada`);
  }

  private open(form: ReplyForm): void {
    this.error.set(null);
    this.form.set(form);
  }
}
