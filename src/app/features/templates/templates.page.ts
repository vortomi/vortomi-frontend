import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import { TEMPLATE_CATEGORY, TEMPLATE_STATUS } from '../../shared/api/labels';
import type { MessageTemplate, TemplateStatus } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { TemplatePreview } from './template-preview';

type StatusFilter = TemplateStatus | 'all';

/** Message templates approved by Meta, per company (mockup web-4). */
@Component({
  selector: 'app-templates-page',
  imports: [RouterLink, Icon, Pill, TemplatePreview],
  templateUrl: './templates.page.html',
  styleUrl: './templates.page.scss',
})
export class TemplatesPage {
  protected readonly workspace = inject(Workspace);
  protected readonly session = inject(Session);
  private readonly router = inject(Router);

  /** ?selected=<templateId> after creating one. */
  readonly selectedId = input<string>(undefined, { alias: 'selected' });

  protected readonly labels = { category: TEMPLATE_CATEGORY, status: TEMPLATE_STATUS };
  protected readonly filter = signal<StatusFilter>('all');
  protected readonly filters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'approved', label: 'Aprobadas' },
    { id: 'pending', label: 'En revisión' },
    { id: 'rejected', label: 'Rechazadas' },
  ];
  private readonly picked = signal<string | null>(null);

  protected readonly list = computed(() =>
    this.workspace.templates().filter((t) => this.filter() === 'all' || t.status === this.filter()),
  );
  protected readonly selected = computed(() => {
    const id = this.picked() ?? this.selectedId();
    return this.workspace.templates().find((t) => t.id === id) ?? this.list()[0] ?? null;
  });

  protected count(id: StatusFilter): number {
    return this.workspace.templates().filter((t) => id === 'all' || t.status === id).length;
  }

  protected pick(template: MessageTemplate): void {
    this.picked.set(template.id);
  }

  protected fixRejected(template: MessageTemplate): void {
    void this.router.navigate(['/templates/new'], { queryParams: { from: template.id } });
  }
}
