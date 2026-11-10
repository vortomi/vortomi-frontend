import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import type { Contact, CustomField, Id } from '../../shared/api/models';
import { formatListStamp } from '../../shared/format/date-time';
import { formatUsdCents } from '../../shared/format/money';
import { toCsv } from '../../shared/files/csv';
import { downloadText } from '../../shared/files/download';
import { Avatar } from '../../shared/ui/avatar';
import { ChannelBadge } from '../../shared/ui/channel-badge';
import { Icon } from '../../shared/ui/icon';
import { Confirm } from '../../shared/ui/confirm';
import { Pill } from '../../shared/ui/pill';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { type FieldFilter, formatValue, matchesFilter } from '../custom-fields/custom-field-rules';
import { CustomFields } from '../custom-fields/custom-fields.data';
import { FieldFilterPicker } from '../custom-fields/field-filter-picker';
import { InboxData } from '../inbox/inbox.data';
import { ContactImportDialog } from './contact-import.dialog';
import { ContactsData } from './contacts.data';
import { type ContactFilters, EMPTY_CONTACT_FILTERS, applyContactFilters } from './contacts.rules';

/** Contacts of the company (mockup web-3). */
@Component({
  selector: 'app-contacts-page',
  imports: [RouterLink, Avatar, ChannelBadge, Icon, Pill, SelectMenu, Skeleton, ContactImportDialog, FieldFilterPicker],
  templateUrl: './contacts.page.html',
  styleUrl: './contacts.page.scss',
})
export class ContactsPage {
  protected readonly data = inject(ContactsData);
  protected readonly workspace = inject(Workspace);
  protected readonly session = inject(Session);
  private readonly inbox = inject(InboxData);
  private readonly clock = inject(Clock);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(Confirm);
  protected readonly customFields = inject(CustomFields);

  protected readonly filters = signal<ContactFilters>(EMPTY_CONTACT_FILTERS);
  protected readonly selected = signal<ReadonlySet<Id>>(new Set());
  protected readonly importing = signal(false);

  /** First read of the list: a skeleton, not "no contact matches". */
  protected readonly loading = computed(() => !this.data.ready() || (this.data.loading() && !this.data.all().length));

  // Filter dropdowns: '' is "any".
  protected readonly channelOptions = computed<MenuOption[]>(() => [
    { value: '', label: 'Todos los números' },
    ...this.workspace.channels().map((c) => ({ value: c.id, label: c.label })),
  ]);
  protected readonly stageOptions = computed<MenuOption[]>(() => [
    { value: '', label: 'Todas las etapas' },
    ...this.workspace.stages().map((s) => ({ value: s.id, label: s.name })),
  ]);
  protected readonly tagOptions = computed<MenuOption[]>(() => [
    { value: '', label: 'Todas las etiquetas' },
    ...this.workspace.tags().map((t) => ({ value: t.id, label: t.name })),
  ]);
  private readonly memberOptions = computed<MenuOption[]>(() => this.workspace.activeTeam().map((m) => ({ value: m.user.id, label: m.user.name })));
  protected readonly ownerFilterOptions = computed<MenuOption[]>(() => [
    { value: '', label: 'Cualquier responsable' },
    { value: 'none', label: 'Sin responsable' },
    ...this.memberOptions(),
  ]);
  protected readonly bulkOwnerOptions = computed<MenuOption[]>(() => [{ value: 'none', label: 'Sin responsable' }, ...this.memberOptions()]);
  protected readonly bulkTagOptions = computed<MenuOption[]>(() => this.workspace.tags().map((t) => ({ value: t.id, label: t.name })));

  /** Filters by the company's own data ("Vehículo: Corolla 2015"); each one adds its column. */
  protected readonly fieldFilters = signal<FieldFilter[]>([]);
  private readonly fieldById = computed(() => new Map(this.customFields.customers().map((f) => [f.id, f])));
  /** The fields being filtered, once each, as extra columns. */
  protected readonly filterColumns = computed(() =>
    [...new Set(this.fieldFilters().map((f) => f.fieldId))].flatMap((id) => {
      const field = this.fieldById().get(id);
      return field ? [field] : [];
    }),
  );

  protected readonly rows = computed(() => {
    const fields = this.fieldById();
    return applyContactFilters(this.data.visible(), this.filters()).filter((contact) =>
      this.fieldFilters().every((f) => {
        const field = fields.get(f.fieldId);
        return !field || matchesFilter(field, contact.customValues[f.fieldId], f.value);
      }),
    );
  });
  protected readonly allSelected = computed(() => this.rows().length > 0 && this.rows().every((c) => this.selected().has(c.id)));

  protected setFilter<K extends keyof ContactFilters>(key: K, event: Event): void {
    this.pickFilter(key, (event.target as HTMLInputElement).value);
  }

  protected pickFilter<K extends keyof ContactFilters>(key: K, value: string): void {
    this.filters.update((f) => ({ ...f, [key]: key === 'search' ? value : value || null }));
  }

  protected addFieldFilter(filter: FieldFilter): void {
    this.fieldFilters.update((list) => [...list.filter((f) => f.fieldId !== filter.fieldId || f.value !== filter.value), filter]);
  }

  protected removeFieldFilter(index: number): void {
    this.fieldFilters.update((list) => list.filter((_, i) => i !== index));
  }

  /** "Vehículo: Corolla 2015", "Mayorista: Sí", "Dirección: contiene «bolívar»". */
  protected filterLabel(filter: FieldFilter): string {
    const field = this.fieldById().get(filter.fieldId);
    if (!field) return filter.value;
    if (field.kind === 'boolean') return `${field.label}: ${filter.value === 'true' ? 'Sí' : 'No'}`;
    if (field.kind === 'choice' || field.kind === 'multi_choice') return `${field.label}: ${field.options.find((o) => o.id === filter.value)?.value ?? '—'}`;
    return `${field.label}: contiene «${filter.value}»`;
  }

  protected answer(field: CustomField, contact: Contact): string {
    return formatValue(field, contact.customValues[field.id]);
  }

  protected lastActivity(contact: Contact): string {
    const conversation = this.inbox.conversationByContact().get(contact.id);
    return conversation ? formatListStamp(conversation.lastMessageAt, this.clock.now(), this.session.timezone()) : '—';
  }

  protected purchases(contact: Contact): string {
    return contact.purchasesCount ? `${contact.purchasesCount} · ${formatUsdCents(contact.purchasesTotalCents)}` : '—';
  }

  protected userName(id: Id | null): string {
    return (id && this.workspace.userById().get(id)?.name) || '';
  }

  protected open(contact: Contact): void {
    void this.router.navigate(['/contacts', contact.id]);
  }

  protected toggle(id: Id, event: Event): void {
    event.stopPropagation();
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  protected toggleAll(): void {
    this.selected.set(this.allSelected() ? new Set() : new Set(this.rows().map((c) => c.id)));
  }

  /** Changes many contacts at once: asked first, and the dialog waits until every change was saved. */
  protected async bulkOwner(value: string): Promise<void> {
    if (!value) return;
    const ownerUserId = value === 'none' ? null : value;
    const ids = [...this.selected()];
    const who = ownerUserId ? this.userName(ownerUserId) : 'nadie';
    const done = await this.confirm.ask({
      title: '¿Cambiar el responsable de ' + ids.length + ' contactos?',
      message: 'Quedarán a cargo de ' + who + '. Reemplaza el responsable que tenga cada uno.',
      confirmLabel: 'Cambiar responsable',
      action: () => Promise.all(ids.map((id) => this.data.update(id, { ownerUserId }))),
    });
    if (done) this.toaster.show(`Responsable cambiado en ${ids.length} contactos`);
  }

  protected async bulkTag(tagId: string): Promise<void> {
    if (!tagId) return;
    const ids = [...this.selected()];
    const name = this.workspace.tagById().get(tagId)?.name ?? '';
    const done = await this.confirm.ask({
      title: '¿Agregar la etiqueta «' + name + '» a ' + ids.length + ' contactos?',
      message: 'Se agrega a cada contacto seleccionado; los que ya la tienen no cambian.',
      confirmLabel: 'Agregar etiqueta',
      action: () => Promise.all(ids.map((id) => this.data.addTag(id, tagId))),
    });
    if (done) this.toaster.show(`Etiqueta agregada a ${ids.length} contactos`);
  }

  /** Admin only: exporting takes the company's customer list out of the system. */
  protected exportCsv(onlySelected: boolean): void {
    const list = onlySelected ? this.rows().filter((c) => this.selected().has(c.id)) : this.rows();
    const tags = this.workspace.tagById();
    const stages = this.workspace.stageById();
    const csv = toCsv(
      ['Nombre', 'Teléfono', 'Número', 'Etapa', 'Etiquetas', 'Responsable', 'Compras', 'Total USD'],
      list.map((c) => [
        c.name,
        c.phone,
        this.workspace.channelById().get(c.channelAccountId)?.label ?? '',
        (c.stageId && stages.get(c.stageId)?.name) || '',
        c.tagIds.map((id) => tags.get(id)?.name ?? '').filter(Boolean).join(', '),
        this.userName(c.ownerUserId),
        String(c.purchasesCount),
        (c.purchasesTotalCents / 100).toFixed(2).replace('.', ','),
      ]),
    );
    downloadText(`contactos-${this.session.tenant()?.slug ?? 'empresa'}.csv`, csv);
    this.toaster.show(`${list.length} contactos exportados`);
  }
}
