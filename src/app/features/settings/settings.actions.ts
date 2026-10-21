import { Injectable, inject } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { CompanyData } from '../../core/company-data';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import type { Id, PipelineStage, QuickReply, Tag, TenantSettings, Tone } from '../../shared/api/models';
import { newId } from '../../shared/api/mock-db';
import { Toaster } from '../../shared/ui/toaster';
import { SettingsRemote } from './settings-remote';

/**
 * Writes of the settings screens, always for the active company. Each one resolves to
 * whether it was saved, so the screen confirms only what really happened.
 * - 'mock': the tables change in memory.
 * - 'api':  server first; the screen shows the row the server stored, or its Spanish error.
 */
@Injectable({ providedIn: 'root' })
export class SettingsActions {
  private readonly company = inject(CompanyData);
  private readonly directory = inject(Directory);
  private readonly session = inject(Session);
  private readonly workspace = inject(Workspace);
  private readonly toaster = inject(Toaster);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(SettingsRemote) : null;

  /** Name, time zone and logo have no place on the server yet (documentations/08, B.2). */
  readonly profileEditable = !this.remote;

  saveCompany(name: string, timezone: string, settings: TenantSettings): Promise<boolean> {
    if (this.remote) {
      return this.write((remote, tenantId) => remote.saveSettings(tenantId, settings), (saved) => this.company.settings.upsert(saved));
    }
    this.directory.updateTenant(this.tenantId(), { name: name.trim(), timezone });
    this.company.settings.upsert(settings);
    return Promise.resolve(true);
  }

  addTag(name: string, tone: Tone): Promise<boolean> {
    if (this.remote) return this.write((remote, tenantId) => remote.createTag(tenantId, name.trim(), tone), (tag) => this.company.tags.upsert(tag));
    this.company.tags.upsert({ id: newId('tag'), tenantId: this.tenantId(), name: name.trim(), tone });
    return Promise.resolve(true);
  }

  updateTag(id: Id, patch: Partial<Pick<Tag, 'name' | 'tone'>>): Promise<boolean> {
    const current = this.workspace.tags().find((t) => t.id === id);
    if (this.remote && current) {
      return this.write((remote, tenantId) => remote.updateTag(tenantId, { ...current, ...patch }), (tag) => this.company.tags.upsert(tag));
    }
    this.company.tags.patch(id, patch);
    return Promise.resolve(true);
  }

  removeTag(id: Id): Promise<boolean> {
    if (this.remote) return this.write((remote, tenantId) => remote.removeTag(tenantId, id), () => this.company.tags.remove(id));
    this.company.tags.remove(id);
    return Promise.resolve(true);
  }

  addStage(name: string, color: string): Promise<boolean> {
    if (this.remote) {
      return this.write((remote, tenantId) => remote.createStage(tenantId, name.trim(), color), (stage) => this.company.stages.upsert(stage));
    }
    const position = Math.max(0, ...this.workspace.stages().map((s) => s.position)) + 1;
    this.company.stages.upsert({ id: newId('stg'), tenantId: this.tenantId(), name: name.trim(), color, position });
    return Promise.resolve(true);
  }

  updateStage(id: Id, patch: Partial<Pick<PipelineStage, 'name' | 'color'>>): Promise<boolean> {
    const current = this.workspace.stages().find((s) => s.id === id);
    if (this.remote && current) {
      return this.write((remote, tenantId) => remote.updateStage(tenantId, { ...current, ...patch }), (stage) => this.company.stages.upsert(stage));
    }
    this.company.stages.patch(id, patch);
    return Promise.resolve(true);
  }

  /** Swaps positions with the neighbour above (-1) or below (+1). */
  moveStage(id: Id, direction: -1 | 1): Promise<boolean> {
    const stages = this.workspace.stages();
    const index = stages.findIndex((s) => s.id === id);
    const other = stages[index + direction];
    const current = stages[index];
    if (!current || !other) return Promise.resolve(false);
    if (this.remote) {
      const order = stages.map((s) => s.id);
      [order[index], order[index + direction]] = [other.id, current.id];
      return this.write((remote, tenantId) => remote.reorderStages(tenantId, order), (saved) => this.company.stages.replaceAll(saved));
    }
    this.company.stages.patch(current.id, { position: other.position });
    this.company.stages.patch(other.id, { position: current.position });
    return Promise.resolve(true);
  }

  removeStage(id: Id): Promise<boolean> {
    if (this.remote) return this.write((remote, tenantId) => remote.removeStage(tenantId, id), () => this.company.stages.remove(id));
    this.company.stages.remove(id);
    return Promise.resolve(true);
  }

  addQuickReply(reply: Pick<QuickReply, 'shortcut' | 'title' | 'body'>): Promise<boolean> {
    if (this.remote) {
      return this.write((remote, tenantId) => remote.createQuickReply(tenantId, reply), (saved) => this.company.quickReplies.upsert(saved));
    }
    this.company.quickReplies.upsert({ id: newId('qr'), tenantId: this.tenantId(), ...reply });
    return Promise.resolve(true);
  }

  updateQuickReply(id: Id, patch: Partial<Pick<QuickReply, 'shortcut' | 'title' | 'body'>>): Promise<boolean> {
    const current = this.workspace.quickReplies().find((r) => r.id === id);
    if (this.remote && current) {
      return this.write(
        (remote, tenantId) => remote.updateQuickReply(tenantId, { ...current, ...patch }),
        (saved) => this.company.quickReplies.upsert(saved),
      );
    }
    this.company.quickReplies.patch(id, patch);
    return Promise.resolve(true);
  }

  removeQuickReply(id: Id): Promise<boolean> {
    if (this.remote) return this.write((remote, tenantId) => remote.removeQuickReply(tenantId, id), () => this.company.quickReplies.remove(id));
    this.company.quickReplies.remove(id);
    return Promise.resolve(true);
  }

  /** 'api' mode: runs the write, applies what the server answered, or shows why it refused. */
  private async write<T>(send: (remote: SettingsRemote, tenantId: Id) => Promise<T>, apply: (saved: T) => void): Promise<boolean> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return false;
    try {
      apply(await send(this.remote, tenantId));
      return true;
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      return false;
    }
  }

  private tenantId(): Id {
    return this.session.tenant()?.id ?? '';
  }
}
