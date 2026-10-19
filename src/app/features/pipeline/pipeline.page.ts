import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import type { Contact, Id, PipelineStage } from '../../shared/api/models';
import { formatUsdCents } from '../../shared/format/money';
import { Avatar } from '../../shared/ui/avatar';
import { ChannelBadge } from '../../shared/ui/channel-badge';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { ContactsData } from '../contacts/contacts.data';
import { InboxData } from '../inbox/inbox.data';
import { formatWaiting, stageTotalCents, waitingLevel, waitingMs } from './pipeline.rules';

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Sales board by stage (mockup web-2). One opportunity per contact in v1. */
@Component({
  selector: 'app-pipeline-page',
  imports: [RouterLink, Avatar, ChannelBadge, Icon],
  templateUrl: './pipeline.page.html',
  styleUrl: './pipeline.page.scss',
})
export class PipelinePage {
  private readonly contacts = inject(ContactsData);
  private readonly inbox = inject(InboxData);
  protected readonly workspace = inject(Workspace);
  protected readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly search = signal('');
  protected readonly channelId = signal('');
  protected readonly ownerId = signal('');
  protected readonly dragging = signal<Id | null>(null);
  protected readonly dropTarget = signal<Id | null>(null);

  private readonly cards = computed(() => {
    const needle = normalize(this.search());
    const now = this.clock.now();
    return this.contacts
      .visible()
      .filter((c) => c.stageId)
      .filter((c) => !this.channelId() || c.channelAccountId === this.channelId())
      .filter((c) => !this.ownerId() || c.ownerUserId === this.ownerId())
      .filter((c) => !needle || normalize(c.name).includes(needle))
      .map((contact) => {
        const conversation = this.inbox.conversationByContact().get(contact.id) ?? null;
        const wait = waitingMs(conversation, conversation ? this.inbox.lastMessageByConversation().get(conversation.id) : undefined, now);
        return { contact, conversation, wait, level: waitingLevel(wait), waitLabel: wait === null ? '' : formatWaiting(wait) };
      });
  });

  protected readonly columns = computed(() =>
    this.workspace.stages().map((stage) => {
      // Longest wait first: whoever has been waiting more gets attention first.
      const cards = this.cards()
        .filter((c) => c.contact.stageId === stage.id)
        .sort((a, b) => (b.wait ?? -1) - (a.wait ?? -1) || a.contact.name.localeCompare(b.contact.name, 'es'));
      return { stage, cards, total: stageTotalCents(cards.map((c) => c.contact)) };
    }),
  );

  protected readonly boardTotal = computed(() => formatUsdCents(stageTotalCents(this.cards().map((c) => c.contact))));

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected userName(id: Id | null): string {
    return (id && this.workspace.userById().get(id)?.name) || '';
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected open(contact: Contact): void {
    void this.router.navigate(['/contacts', contact.id]);
  }

  protected onDragStart(contact: Contact, event: DragEvent): void {
    this.dragging.set(contact.id);
    event.dataTransfer?.setData('text/plain', contact.id);
  }

  protected onDragOver(stage: PipelineStage, event: DragEvent): void {
    event.preventDefault();
    this.dropTarget.set(stage.id);
  }

  protected onDrop(stage: PipelineStage, event: DragEvent): void {
    event.preventDefault();
    const id = this.dragging() ?? event.dataTransfer?.getData('text/plain');
    this.dragging.set(null);
    this.dropTarget.set(null);
    if (id) this.move(id, stage.id);
  }

  /** Keyboard and touch alternative to dragging. */
  protected moveFromMenu(contact: Contact, event: Event): void {
    event.stopPropagation();
    this.move(contact.id, this.value(event));
  }

  private move(contactId: Id, stageId: Id): void {
    const contact = this.contacts.byId().get(contactId);
    const stage = this.workspace.stageById().get(stageId);
    if (!contact || !stage || contact.stageId === stageId) return;
    this.contacts.setStage(contactId, stageId);
    this.toaster.show(`${contact.name} pasó a «${stage.name}»`);
  }
}
