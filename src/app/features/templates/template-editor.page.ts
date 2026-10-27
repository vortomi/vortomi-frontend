import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { TEMPLATE_CATEGORY } from '../../shared/api/labels';
import type { TemplateCategory } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { TemplatePreview } from './template-preview';
import { TemplatesActions } from './templates.actions';
import { MAX_BODY_LENGTH, type TemplateDraft, renderPreview, templateIssues, templateVariables } from './templates.rules';

interface EditorModel {
  name: string;
  category: TemplateCategory;
  body: string;
}

/** New template (/templates/new, or ?from=<id> to fix a rejected one). */
@Component({
  selector: 'app-template-editor-page',
  imports: [FormField, RouterLink, Icon, TemplatePreview],
  templateUrl: './template-editor.page.html',
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .back { display: inline-flex; color: var(--color-text-muted); --icon-size: 22px; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; align-items: start; }
    .box { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
    .g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; }
    .issues { display: flex; flex-direction: column; gap: 8px; }
    .count { text-align: right; }
    .preview-col { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 0; }
    @media (max-width: 1200px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class TemplateEditorPage {
  private readonly workspace = inject(Workspace);
  protected readonly session = inject(Session);
  private readonly actions = inject(TemplatesActions);
  private readonly router = inject(Router);

  /** ?from=<templateId> copies a rejected template to fix it. */
  readonly from = input<string>();

  protected readonly categories = Object.entries(TEMPLATE_CATEGORY) as [TemplateCategory, (typeof TEMPLATE_CATEGORY)[TemplateCategory]][];
  protected readonly maxLength = MAX_BODY_LENGTH;
  protected readonly examples = signal<string[]>([]);

  private readonly model = signal<EditorModel>({ name: '', category: 'utility', body: '' });
  protected readonly editor = form(this.model, (path) => {
    required(path.name, { message: 'Ponle un nombre.' });
    required(path.body, { message: 'Escribe el texto.' });
  });

  protected readonly variables = computed(() => [...templateVariables(this.model().body)].sort((a, b) => a - b));
  protected readonly draft = computed<TemplateDraft>(() => ({ ...this.model(), language: 'es', examples: this.examples() }));
  protected readonly issues = computed(() =>
    templateIssues(
      this.draft(),
      this.workspace.templates().map((t) => t.name),
    ),
  );
  protected readonly blocking = computed(() => this.issues().some((i) => i.level === 'error'));
  protected readonly preview = computed(() => renderPreview(this.model().body, this.examples()));
  protected readonly showIssues = signal(false);

  constructor() {
    effect(() => {
      const source = this.workspace.templates().find((t) => t.id === this.from());
      if (source) untracked(() => this.model.set({ name: `${source.name}_v2`, category: source.category, body: source.body }));
    });
  }

  protected setExample(n: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.examples.update((list) => {
      const next = [...list];
      next[n - 1] = value;
      return next;
    });
  }

  protected send(event: Event): void {
    event.preventDefault();
    this.showIssues.set(true);
    this.editor.name().markAsTouched();
    this.editor.body().markAsTouched();
    if (this.blocking()) return;
    const template = this.actions.submit(this.draft());
    void this.router.navigate(['/templates'], { queryParams: { selected: template.id } });
  }
}
