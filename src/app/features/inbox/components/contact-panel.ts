import { Component, computed, inject, input } from '@angular/core';
import { Session } from '../../../core/session';
import { Workspace } from '../../../core/workspace';
import type { Contact, Tag } from '../../../shared/api/models';
import { formatMonthYear } from '../../../shared/format/date-time';
import { formatUsdCents } from '../../../shared/format/money';
import { Avatar } from '../../../shared/ui/avatar';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';
import { ContactsData } from '../../contacts/contacts.data';

/** Customer card next to the chat: stage, tags and the company's own fields. */
@Component({
  selector: 'app-contact-panel',
  imports: [Avatar, Icon, Pill],
  templateUrl: './contact-panel.html',
  styleUrl: './contact-panel.scss',
})
export class ContactPanel {
  private readonly data = inject(ContactsData);
  private readonly session = inject(Session);
  protected readonly workspace = inject(Workspace);

  readonly contact = input.required<Contact>();

  protected readonly since = computed(() => formatMonthYear(this.contact().createdAt, this.session.timezone()));
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

  protected onStage(event: Event): void {
    this.data.setStage(this.contact().id, (event.target as HTMLSelectElement).value || null);
  }

  protected onAddTag(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) this.data.addTag(this.contact().id, select.value);
    select.value = '';
  }

  protected removeTag(tag: Tag): void {
    this.data.removeTag(this.contact().id, tag.id);
  }
}
