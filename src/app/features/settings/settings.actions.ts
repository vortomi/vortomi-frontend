import { Injectable, inject } from '@angular/core';
import { CompanyData } from '../../core/company-data';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import type { Id, PipelineStage, QuickReply, Tag, TenantSettings, Tone } from '../../shared/api/models';
import { newId } from '../../shared/api/mock-db';

/** Writes of the settings screens, always for the active company. */
@Injectable({ providedIn: 'root' })
export class SettingsActions {
  private readonly company = inject(CompanyData);
  private readonly directory = inject(Directory);
  private readonly session = inject(Session);
  private readonly workspace = inject(Workspace);

  private tenantId(): Id {
    return this.session.tenant()?.id ?? '';
  }

  saveCompany(name: string, timezone: string, settings: TenantSettings): void {
    this.directory.updateTenant(this.tenantId(), { name: name.trim(), timezone });
    this.company.settings.upsert(settings);
  }

  addTag(name: string, tone: Tone): void {
    this.company.tags.upsert({ id: newId('tag'), tenantId: this.tenantId(), name: name.trim(), tone });
  }

  updateTag(id: Id, patch: Partial<Pick<Tag, 'name' | 'tone'>>): void {
    this.company.tags.patch(id, patch);
  }

  removeTag(id: Id): void {
    this.company.tags.remove(id);
  }

  addStage(name: string, color: string): void {
    const position = Math.max(0, ...this.workspace.stages().map((s) => s.position)) + 1;
    this.company.stages.upsert({ id: newId('stg'), tenantId: this.tenantId(), name: name.trim(), color, position });
  }

  updateStage(id: Id, patch: Partial<Pick<PipelineStage, 'name' | 'color'>>): void {
    this.company.stages.patch(id, patch);
  }

  /** Swaps positions with the neighbour above (-1) or below (+1). */
  moveStage(id: Id, direction: -1 | 1): void {
    const stages = this.workspace.stages();
    const index = stages.findIndex((s) => s.id === id);
    const other = stages[index + direction];
    const current = stages[index];
    if (!current || !other) return;
    this.company.stages.patch(current.id, { position: other.position });
    this.company.stages.patch(other.id, { position: current.position });
  }

  removeStage(id: Id): void {
    this.company.stages.remove(id);
  }

  addQuickReply(reply: Pick<QuickReply, 'shortcut' | 'title' | 'body'>): void {
    this.company.quickReplies.upsert({ id: newId('qr'), tenantId: this.tenantId(), ...reply });
  }

  updateQuickReply(id: Id, patch: Partial<Pick<QuickReply, 'shortcut' | 'title' | 'body'>>): void {
    this.company.quickReplies.patch(id, patch);
  }

  removeQuickReply(id: Id): void {
    this.company.quickReplies.remove(id);
  }
}
