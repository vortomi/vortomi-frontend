import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormField, form, readonly, required, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import type { Contact, ContactAttribute, Id } from '../../shared/api/models';
import { formatListStamp, formatMonthYear } from '../../shared/format/date-time';
import { formatUsdCents, parsePriceCents } from '../../shared/format/money';
import { toWaId } from '../../shared/format/phone';
import { Avatar } from '../../shared/ui/avatar';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { slugify } from '../../shared/format/slug';
import { InboxData } from '../inbox/inbox.data';
import { ContactsData } from './contacts.data';
import { findDuplicate } from './contacts.rules';

interface ContactModel {
  name: string;
  phone: string;
  channelAccountId: string;
  ownerUserId: string;
  stageId: string;
  quote: string;
}

/** Create (/contacts/new) or edit (/contacts/:contactId) one contact. */
@Component({
  selector: 'app-contact-detail-page',
  imports: [FormField, RouterLink, Avatar, FieldError, Icon, Pill],
  templateUrl: './contact-detail.page.html',
  styleUrl: './contact-detail.page.scss',
})
export class ContactDetailPage {
  private readonly contacts = inject(ContactsData);
  private readonly inbox = inject(InboxData);
  protected readonly workspace = inject(Workspace);
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  readonly contactId = input<string>();

  protected readonly contact = computed(() => this.contacts.byId().get(this.contactId() ?? '') ?? null);
  protected readonly isNew = computed(() => !this.contactId());
  protected readonly duplicate = signal<Contact | null>(null);
  protected readonly tagIds = signal<Id[]>([]);
  protected readonly attributes = signal<ContactAttribute[]>([]);
  protected readonly newFieldLabel = signal('');

  private readonly model = signal<ContactModel>({ name: '', phone: '', channelAccountId: '', ownerUserId: '', stageId: '', quote: '' });
  protected readonly contactForm = form(this.model, (path) => {
    required(path.name, { message: 'Escribe el nombre.' });
    required(path.phone, { message: 'Escribe el teléfono.' });
    validate(path.phone, ({ value }) =>
      value() && !toWaId(value()) ? { kind: 'phone', message: 'Teléfono no válido. Ejemplo: 0414-555-0187' } : undefined,
    );
    required(path.channelAccountId, { message: 'Elige el número.' });
    validate(path.quote, ({ value }) =>
      value().trim() && parsePriceCents(value()) === null ? { kind: 'price', message: 'Monto no válido. Ejemplo: 43,50' } : undefined,
    );
    // The phone and number identify the WhatsApp conversation; they never change after creation.
    readonly(path.phone, () => !this.isNew());
    readonly(path.channelAccountId, () => !this.isNew());
  });

  protected readonly conversation = computed(() => {
    const contact = this.contact();
    const conversation = contact ? this.inbox.conversationByContact().get(contact.id) : undefined;
    return conversation && this.inbox.findItem(conversation.id) ? conversation : null;
  });

  constructor() {
    effect(() => {
      const contact = this.contact();
      const firstChannel = this.workspace.channels()[0]?.id ?? '';
      untracked(() => {
        this.model.set({
          name: contact?.name ?? '',
          phone: contact?.phone ?? '',
          channelAccountId: contact?.channelAccountId ?? firstChannel,
          ownerUserId: contact?.ownerUserId ?? '',
          stageId: contact?.stageId ?? '',
          quote: contact?.quoteCents ? (contact.quoteCents / 100).toFixed(2).replace('.', ',') : '',
        });
        this.tagIds.set(contact?.tagIds ?? []);
        this.attributes.set(contact?.attributes ?? []);
        this.duplicate.set(null);
      });
    });
  }

  protected since(contact: Contact): string {
    return formatMonthYear(contact.createdAt, this.session.timezone());
  }

  protected purchases(contact: Contact): string {
    return contact.purchasesCount ? `${contact.purchasesCount} · ${formatUsdCents(contact.purchasesTotalCents)}` : 'Ninguna todavía';
  }

  protected stamp(iso: string): string {
    return formatListStamp(iso, this.clock.now(), this.session.timezone());
  }

  protected toggleTag(tagId: Id): void {
    this.tagIds.update((ids) => (ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId]));
  }

  protected setAttribute(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.attributes.update((list) => list.map((a, i) => (i === index ? { ...a, value } : a)));
  }

  protected removeAttribute(index: number): void {
    this.attributes.update((list) => list.filter((_, i) => i !== index));
  }

  protected addAttribute(): void {
    const label = this.newFieldLabel().trim();
    if (!label || this.attributes().some((a) => a.label.toLowerCase() === label.toLowerCase())) return;
    this.attributes.update((list) => [...list, { key: slugify(label), label, value: '' }]);
    this.newFieldLabel.set('');
  }

  protected onNewFieldLabel(event: Event): void {
    this.newFieldLabel.set((event.target as HTMLInputElement).value);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.contactForm, async () => {
      const value = this.model();
      const shared = {
        name: value.name.trim(),
        ownerUserId: value.ownerUserId || null,
        stageId: value.stageId || null,
        quoteCents: parsePriceCents(value.quote),
        tagIds: this.tagIds(),
        attributes: this.attributes().filter((a) => a.value.trim()),
      };
      const existing = this.contact();
      if (existing) {
        if (await this.contacts.update(existing.id, shared)) this.toaster.show('Contacto guardado');
        return undefined;
      }
      const waId = toWaId(value.phone)!;
      const duplicate = findDuplicate(this.contacts.all(), value.channelAccountId, waId);
      if (duplicate) {
        this.duplicate.set(duplicate);
        return undefined;
      }
      const created = await this.contacts.create({ ...shared, waId, channelAccountId: value.channelAccountId });
      if (!created) return undefined;
      this.toaster.show('Contacto creado');
      await this.router.navigate(['/contacts', created.id]);
      return undefined;
    });
  }
}
