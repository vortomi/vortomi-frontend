import { Component, inject, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../../core/clock';
import { Session } from '../../../core/session';
import { Workspace } from '../../../core/workspace';
import type { Id } from '../../../shared/api/models';
import { formatListStamp } from '../../../shared/format/date-time';
import { Avatar } from '../../../shared/ui/avatar';
import { ChannelBadge } from '../../../shared/ui/channel-badge';
import { Pill } from '../../../shared/ui/pill';
import type { InboxFilters, InboxItem, InboxView, ViewCounts } from '../inbox.filters';

@Component({
  selector: 'app-conversation-list',
  imports: [RouterLink, Avatar, ChannelBadge, Pill],
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

  protected readonly views: { id: InboxView; label: string }[] = [
    { id: 'mine', label: 'Mías' },
    { id: 'unassigned', label: 'Sin asignar' },
    { id: 'all', label: 'Todas' },
  ];

  protected stamp(iso: string): string {
    return formatListStamp(iso, this.clock.now(), this.session.timezone());
  }

  protected userName(id: Id | null): string {
    return (id && this.workspace.userById().get(id)?.name) || '';
  }

  protected setView(view: InboxView): void {
    this.filters.update((f) => ({ ...f, view }));
  }

  protected setChannel(event: Event): void {
    const channelId = (event.target as HTMLSelectElement).value || null;
    this.filters.update((f) => ({ ...f, channelId }));
  }

  protected setTag(event: Event): void {
    const tagId = (event.target as HTMLSelectElement).value || null;
    this.filters.update((f) => ({ ...f, tagId }));
  }
}
