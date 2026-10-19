import { Injectable, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import type { MessageTemplate, PipelineStage, QuickReply, Tag, TenantSettings } from '../shared/api/models';
import { allLoaded } from '../shared/api/mock-db';
import { editableTable } from '../shared/api/editable-table';

/**
 * Configuration tables each company edits: tags, pipeline stages, quick replies, templates and
 * settings. Holds every company's rows; Workspace exposes the active company's slice.
 */
@Injectable({ providedIn: 'root' })
export class CompanyData {
  readonly tags = editableTable<Tag>('tags');
  readonly stages = editableTable<PipelineStage>('pipeline-stages');
  readonly quickReplies = editableTable<QuickReply>('quick-replies');
  readonly templates = editableTable<MessageTemplate>('templates');
  readonly settings = editableTable<TenantSettings>('tenant-settings');

  readonly ready = computed(() => allLoaded(this.tags, this.stages, this.quickReplies, this.templates, this.settings));

  /** Resolves once every table is loaded; guards wait on it before deciding. */
  readonly loaded: Promise<void> = firstValueFrom(toObservable(this.ready).pipe(filter(Boolean))).then(() => undefined);
}
