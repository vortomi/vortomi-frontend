import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { ApiList, ApiQuickReply, ApiSettings, ApiStage, ApiTag } from '../../shared/api/contract';
import { toQuickReply, toSettings, toStage, toTag } from '../../shared/api/mappers';
import type { Id, PipelineStage, QuickReply, Tag, TenantSettings, Tone } from '../../shared/api/models';

/**
 * Settings against vortomi-backend ('api' mode). Every write returns the row as the server
 * stored it, already as a panel model. Only admins may write; the server enforces it.
 */
@Injectable({ providedIn: 'root' })
export class SettingsRemote {
  private readonly api = inject(ApiClient);

  async saveSettings(tenantId: Id, settings: TenantSettings): Promise<TenantSettings> {
    const body: ApiSettings = {
      // Missing in the panel model means the default, as on the server.
      workMode: settings.workMode ?? 'sales_and_support',
      businessHours: settings.businessHours,
      awayMessage: settings.awayMessage,
    };
    return toSettings(tenantId, await this.api.put<ApiSettings>(this.api.company(tenantId, 'settings'), body));
  }

  saveProfile(tenantId: Id, name: string, timezone: string): Promise<{ name: string; timezone: string }> {
    return this.api.put(this.api.company(tenantId, 'profile'), { name, timezone });
  }

  async createTag(tenantId: Id, name: string, tone: Tone): Promise<Tag> {
    return toTag(tenantId, await this.api.post<ApiTag>(this.api.company(tenantId, 'tags'), { name, tone }));
  }

  async updateTag(tenantId: Id, tag: Tag): Promise<Tag> {
    const body = { name: tag.name, tone: tag.tone };
    return toTag(tenantId, await this.api.put<ApiTag>(this.item(tenantId, 'tags', tag.id), body));
  }

  removeTag(tenantId: Id, id: Id): Promise<void> {
    return this.api.delete(this.item(tenantId, 'tags', id));
  }

  async createStage(tenantId: Id, name: string, color: string): Promise<PipelineStage> {
    return toStage(tenantId, await this.api.post<ApiStage>(this.api.company(tenantId, 'pipeline/stages'), { name, color }));
  }

  async updateStage(tenantId: Id, stage: PipelineStage): Promise<PipelineStage> {
    const body = { name: stage.name, color: stage.color };
    return toStage(tenantId, await this.api.put<ApiStage>(this.item(tenantId, 'pipeline/stages', stage.id), body));
  }

  removeStage(tenantId: Id, id: Id): Promise<void> {
    return this.api.delete(this.item(tenantId, 'pipeline/stages', id));
  }

  /** The whole list in its new order; the server answers with every stage and its position. */
  async reorderStages(tenantId: Id, stageIds: Id[]): Promise<PipelineStage[]> {
    const list = await this.api.put<ApiList<ApiStage>>(this.api.company(tenantId, 'pipeline/order'), { stageIds });
    return list.items.map((row) => toStage(tenantId, row));
  }

  async createQuickReply(tenantId: Id, reply: Pick<QuickReply, 'shortcut' | 'title' | 'body'>): Promise<QuickReply> {
    return toQuickReply(tenantId, await this.api.post<ApiQuickReply>(this.api.company(tenantId, 'quick-replies'), reply));
  }

  async updateQuickReply(tenantId: Id, reply: QuickReply): Promise<QuickReply> {
    const body = { shortcut: reply.shortcut, title: reply.title, body: reply.body };
    return toQuickReply(tenantId, await this.api.put<ApiQuickReply>(this.item(tenantId, 'quick-replies', reply.id), body));
  }

  removeQuickReply(tenantId: Id, id: Id): Promise<void> {
    return this.api.delete(this.item(tenantId, 'quick-replies', id));
  }

  private item(tenantId: Id, resource: string, id: Id): string {
    return this.api.company(tenantId, `${resource}/${encodeURIComponent(id)}`);
  }
}
