import { Component, computed, inject, input, signal } from '@angular/core';
import { Session } from '../../../core/session';
import { Workspace } from '../../../core/workspace';
import type { Contact, Tag } from '../../../shared/api/models';
import { formatMonthYear } from '../../../shared/format/date-time';
import { formatUsdCents } from '../../../shared/format/money';
import { Avatar } from '../../../shared/ui/avatar';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';
import { type MenuOption, SelectMenu } from '../../../shared/ui/select-menu';
import { ContactsData } from '../../contacts/contacts.data';

/** Customer card next to the chat: stage, tags and the company's own fields. */
@Component({
  selector: 'app-contact-panel',
  imports: [Avatar, Icon, Pill, SelectMenu],
  templateUrl: './contact-panel.html',
  styleUrl: './contact-panel.scss',
})
export class ContactPanel {
  private readonly data = inject(ContactsData);
  private readonly session = inject(Session);
  protected readonly workspace = inject(Workspace);

  readonly contact = input.required<Contact>();

  /** A stage or tag change on its way to the server: the controls wait for it. */
  protected readonly saving = signal(false);
  /** '' is "no stage". */
  protected readonly stageOptions = computed<MenuOption[]>(() => [
    { value: '', label: 'Sin etapa' },
    ...this.workspace.stages().map((s) => ({ value: s.id, label: s.name })),
  ]);
  protected readonly tagOptions = computed<MenuOption[]>(() => this.availableTags().map((t) => ({ value: t.id, label: t.name })));

  protected readonly since = computed(() => {
    const createdAt = this.contact().createdAt;
    return createdAt ? formatMonthYear(createdAt, this.session.timezone()) : '';
  });
  protected readonly stage = computed(() => {
    const id = this.contact().stageId;
    return id ? this.workspace.stageById().get(id) : undefined;
  });
  protected readonly tags = computed(() =>
    this.contact().tagIds.flatMap((id) => {
      const tag = this.workspace.tagById().get(id);
      return tag ? [tag] : [];
    }),
  );
  protected readonly availableTags = computed(() =>
    this.workspace.tags().filter((t) => !this.contact().tagIds.includes(t.id)),
  );
  protected readonly owner = computed(() => {
    const id = this.contact().ownerUserId;
    return (id && this.workspace.userById().get(id)?.name) || 'Sin responsable';
  });
  protected readonly purchases = computed(() => {
    const { purchasesCount, purchasesTotalCents } = this.contact();
    return purchasesCount ? `${purchasesCount} · ${formatUsdCents(purchasesTotalCents)}` : 'Ninguna todavía';
  });

  protected onStage(value: string): void {
    void this.wait(this.data.setStage(this.contact().id, value || null));
  }

  protected onAddTag(tagId: string): void {
    if (tagId) void this.wait(this.data.addTag(this.contact().id, tagId));
  }

  protected removeTag(tag: Tag): void {
    void this.wait(this.data.removeTag(this.contact().id, tag.id));
  }

  private async wait(work: Promise<unknown>): Promise<void> {
    this.saving.set(true);
    try {
      await work;
    } finally {
      this.saving.set(false);
    }
  }
}
