import { Component, computed, inject, signal } from '@angular/core';
import { Workspace } from '../../core/workspace';
import { CompanySettings } from './company-settings';
import { ExchangeRateSettings } from './exchange-rate-settings';
import { QuickRepliesSettings } from './quick-replies-settings';
import { StagesSettings } from './stages-settings';
import { TagsSettings } from './tags-settings';
import { BRAND } from '../../core/brand';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';

type Tab = 'company' | 'rate' | 'tags' | 'stages' | 'replies';

/** Company settings, admins only. */
@Component({
  selector: 'app-settings-page',
  imports: [CompanySettings, ExchangeRateSettings, TagsSettings, StagesSettings, QuickRepliesSettings],
  template: `
    <header class="page-top">
      <h1>Ajustes</h1>
      <span class="sub">Cómo funciona {{ brand.name }} para tu empresa</span>
    </header>
    <nav class="tabs" role="tablist" aria-label="Secciones de ajustes">
      @for (t of tabs(); track t.id) {
        <button type="button" role="tab" [class.on]="tab() === t.id" [attr.aria-selected]="tab() === t.id" (click)="select(t.id)">{{ t.label }}</button>
      }
    </nav>
    <div class="page-body">
      @switch (tab()) {
        @case ('company') { <app-company-settings /> }
        @case ('rate') { <app-exchange-rate-settings /> }
        @case ('tags') { <app-tags-settings /> }
        @case ('stages') { <app-stages-settings /> }
        @case ('replies') { <app-quick-replies-settings /> }
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .tabs { display: flex; gap: 22px; padding: 0 26px; background: var(--color-surface); border-bottom: 1px solid var(--color-border);
      flex-shrink: 0; overflow-x: auto; }
    .tabs button { border: 0; background: none; padding: 12px 0; font-size: 13.5px; color: var(--color-text-muted); cursor: pointer;
      border-bottom: 2px solid transparent; white-space: nowrap; }
    .tabs button.on { color: var(--color-primary); font-weight: 600; border-bottom-color: var(--color-primary); }
  `,
})
export class SettingsPage {
  protected readonly brand = BRAND;
  private readonly workspace = inject(Workspace);
  private readonly allTabs: { id: Tab; label: string; salesOnly?: boolean }[] = [
    { id: 'company', label: 'Empresa' },
    { id: 'rate', label: 'Tasa de cambio', salesOnly: true },
    { id: 'tags', label: 'Etiquetas' },
    { id: 'stages', label: 'Etapas del pipeline', salesOnly: true },
    { id: 'replies', label: 'Respuestas rápidas' },
  ];
  protected readonly tabs = computed(() => this.allTabs.filter((t) => !t.salesOnly || this.workspace.sells()));
  protected readonly tab = signal<Tab>('company');
  private readonly unsaved = inject(UnsavedChanges);

  /** Changing tab closes the current form: ask first if it has unsaved changes. */
  protected async select(tab: Tab): Promise<void> {
    if (tab !== this.tab() && (await this.unsaved.mayLeave())) this.tab.set(tab);
  }
}
