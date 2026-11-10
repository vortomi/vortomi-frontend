import { Component, computed, inject, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../../core/clock';
import { Session } from '../../../core/session';
import { Workspace } from '../../../core/workspace';
import type { Id } from '../../../shared/api/models';
import { formatListStamp } from '../../../shared/format/date-time';
import { Avatar } from '../../../shared/ui/avatar';
import { ChannelBadge } from '../../../shared/ui/channel-badge';
import { Pill } from '../../../shared/ui/pill';
import { type MenuOption, SelectMenu } from '../../../shared/ui/select-menu';
import type { InboxFilters, InboxItem, InboxView, ViewCounts } from '../inbox.filters';
import { HANDOFF_LABEL } from '../../agent/agent.models';

@Component({
  selector: 'app-conversation-list',
  imports: [RouterLink, Avatar, ChannelBadge, Pill, SelectMenu],
  templateUrl: './conversation-list.html',
  styleUrl: './conversation-list.scss',
})
export class ConversationList {
  private readonly clock = inject(Clock);
  private readonly session = inject(Session);
  protected readonly workspace = inject(Workspace);

  readonly items = input.required<InboxItem[]>();
  readonly counts = input.required<ViewCounts>();
  readonly selectedId = input<Id>();
  readonly filters = model.required<InboxFilters>();

  /** "Sin asignar" is the admins' tray: an agent only ever sees conversations assigned to them. */
  protected readonly handoffLabel = HANDOFF_LABEL;
  protected readonly views = computed<{ id: InboxView; label: string }[]>(() => [
    { id: 'mine', label: 'Mías' },
    ...(this.session.isTenantAdmin() ? [{ id: 'unassigned' as const, label: 'Sin asignar' }] : []),
    { id: 'all', label: 'Todas' },
  ]);

  /** '' is "all": the filters keep null for it. */
  protected readonly channelOptions = computed<MenuOption[]>(() => [
    { value: '', label: 'Todos los números' },
    ...this.workspace.channels().map((c) => ({ value: c.id, label: c.label })),
  ]);
  protected readonly tagOptions = computed<MenuOption[]>(() => [
    { value: '', label: 'Etiquetas' },
    ...this.workspace.tags().map((t) => ({ value: t.id, label: t.name })),
  ]);

  protected stamp(iso: string): string {
    return formatListStamp(iso, this.clock.now(), this.session.timezone());
  }

  protected userName(id: Id | null): string {
    return (id && this.workspace.userById().get(id)?.name) || '';
  }

  protected setView(view: InboxView): void {
    this.filters.update((f) => ({ ...f, view }));
  }

  protected setChannel(value: string): void {
    const channelId = value || null;
    this.filters.update((f) => ({ ...f, channelId }));
  }

  protected setTag(value: string): void {
    const tagId = value || null;
    this.filters.update((f) => ({ ...f, tagId }));
  }
}
