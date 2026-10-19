import { Component, inject, signal } from '@angular/core';
import { Workspace } from '../../core/workspace';
import type { QuickReply } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { SettingsActions } from './settings.actions';
import { shortcutError } from './settings.rules';

@Component({
  selector: 'app-quick-replies-settings',
  imports: [Icon],
  template: `
    <section class="card box">
      <h2>Respuestas rápidas</h2>
      <p class="field-hint">En la bandeja, escribe / y el atajo para insertarlas. Son de toda la empresa.</p>
      <div class="rows">
        @for (reply of workspace.quickReplies(); track reply.id) {
          <div class="reply">
            <div class="reply-head">
              <span class="slash">/</span>
              <input class="input short" [attr.aria-label]="'Atajo de ' + reply.title" [value]="reply.shortcut" (change)="setShortcut(reply, $event)" />
              <input class="input grow" [attr.aria-label]="'Título de ' + reply.shortcut" [value]="reply.title" (change)="setField(reply, 'title', $event)" />
              <button type="button" class="link danger" (click)="remove(reply)">Borrar</button>
            </div>
            <textarea class="input" rows="2" [attr.aria-label]="'Texto de /' + reply.shortcut" [value]="reply.body" (change)="setField(reply, 'body', $event)"></textarea>
          </div>
        }
      </div>
      <div class="reply new">
        <div class="reply-head">
          <span class="slash">/</span>
          <input class="input short" placeholder="atajo" aria-label="Atajo nuevo" [value]="draft().shortcut" (input)="setDraft('shortcut', $event)" />
          <input class="input grow" placeholder="Título" aria-label="Título nuevo" [value]="draft().title" (input)="setDraft('title', $event)" />
        </div>
        <textarea class="input" rows="2" placeholder="Texto que se inserta" aria-label="Texto nuevo" [value]="draft().body" (input)="setDraft('body', $event)"></textarea>
        <div class="actions"><button type="button" class="btn" (click)="add()"><app-icon name="plus" />Agregar respuesta</button></div>
      </div>
    </section>
  `,
  styleUrl: './settings-section.scss',
  styles: `
    .reply { display: flex; flex-direction: column; gap: 8px; padding: 12px 0; border-top: 1px solid var(--color-border-soft); }
    .reply:first-child { border-top: 0; }
    .reply.new { border-top: 1px dashed var(--color-border); }
    .reply-head { display: flex; gap: 8px; align-items: center; }
    .slash { font-family: var(--font-mono); font-weight: 700; color: var(--color-primary-strong); }
    .short { width: 140px; font-family: var(--font-mono); }
    .grow { flex: 1; }
  `,
})
export class QuickRepliesSettings {
  protected readonly workspace = inject(Workspace);
  private readonly actions = inject(SettingsActions);
  private readonly toaster = inject(Toaster);

  protected readonly draft = signal({ shortcut: '', title: '', body: '' });

  private taken(exceptId?: string): string[] {
    return this.workspace.quickReplies().filter((r) => r.id !== exceptId).map((r) => r.shortcut);
  }

  protected setShortcut(reply: QuickReply, event: Event): void {
    const input = event.target as HTMLInputElement;
    const shortcut = input.value.trim().replace(/^\//, '');
    const error = shortcutError(shortcut, this.taken(reply.id));
    if (error) {
      this.toaster.show(error, 'info');
      input.value = reply.shortcut;
      return;
    }
    this.actions.updateQuickReply(reply.id, { shortcut });
  }

  protected setField(reply: QuickReply, key: 'title' | 'body', event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    if (value) this.actions.updateQuickReply(reply.id, { [key]: value });
  }

  protected setDraft(key: 'shortcut' | 'title' | 'body', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected add(): void {
    const { shortcut, title, body } = this.draft();
    const clean = shortcut.trim().replace(/^\//, '');
    const error = shortcutError(clean, this.taken()) ?? (!title.trim() || !body.trim() ? 'Escribe el título y el texto.' : null);
    if (error) return this.toaster.show(error, 'info');
    this.actions.addQuickReply({ shortcut: clean, title: title.trim(), body: body.trim() });
    this.draft.set({ shortcut: '', title: '', body: '' });
    this.toaster.show(`Respuesta /${clean} agregada`);
  }

  protected remove(reply: QuickReply): void {
    this.actions.removeQuickReply(reply.id);
    this.toaster.show(`Respuesta /${reply.shortcut} borrada`);
  }
}
