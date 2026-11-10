import { Component, type OnInit, computed, inject, input, signal } from '@angular/core';
import type { CustomField, CustomFieldEntity, CustomFieldKind, Id } from '../../shared/api/models';
import { Confirm } from '../../shared/ui/confirm';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { ContactsData } from '../contacts/contacts.data';
import { CategoriesData } from '../inventory/categories.data';
import { InventoryData } from '../inventory/inventory.data';
import { CustomFields } from './custom-fields.data';
import { KIND_EXAMPLE, KIND_LABEL, MAX_FIELDS, SUGGESTIONS, isAnswered, isList } from './custom-field-rules';

/** What the editor holds; `id` null while creating. Options keep their id when they exist. */
interface Draft {
  id: Id | null;
  label: string;
  kind: CustomFieldKind;
  required: boolean;
  options: { id?: Id; value: string }[];
  categoryIds: Id[];
}

const KINDS = Object.keys(KIND_LABEL) as CustomFieldKind[];
const blank = (): Draft => ({ id: null, label: '', kind: 'text', required: false, options: [], categoryIds: [] });

/**
 * Ajustes → «Datos de productos» / «Datos de clientes»: the company's own fields, defined
 * once. A list of them, and one editor that opens to create or change a field. For customers,
 * the notes typed before fields existed can be turned into a field in one go.
 */
@Component({
  selector: 'app-custom-fields-settings',
  imports: [Icon, Pill, SelectMenu, Skeleton],
  templateUrl: './custom-fields-settings.html',
  styleUrls: ['../../shared/ui/section.scss', './custom-fields-settings.scss'],
})
export class CustomFieldsSettings implements OnInit {
  readonly entity = input.required<CustomFieldEntity>();

  private readonly data = inject(CustomFields);
  protected readonly categories = inject(CategoriesData);
  private readonly inventory = inject(InventoryData);
  private readonly contacts = inject(ContactsData);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly kinds = KINDS;
  protected readonly kindOptions: MenuOption[] = KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }));
  protected readonly ready = this.data.ready;
  /** The note being turned into a field, while the server works. */
  protected readonly organizing = signal<string | null>(null);
  protected readonly kindLabel = KIND_LABEL;
  protected readonly kindExample = KIND_EXAMPLE;
  protected readonly isList = isList;
  protected readonly max = MAX_FIELDS;

  protected readonly fields = computed(() => this.data.of(this.entity()));
  protected readonly isProduct = computed(() => this.entity() === 'product');
  protected readonly suggestions = computed(() => {
    const taken = new Set(this.fields().map((f) => f.label.toLowerCase()));
    return SUGGESTIONS[this.entity()].filter((s) => !taken.has(s.label.toLowerCase()));
  });

  /** Null: the editor is closed. */
  protected readonly draft = signal<Draft | null>(null);
  protected readonly optionText = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notes = signal<{ label: string; count: number }[]>([]);

  constructor() {
    inject(UnsavedChanges).track(computed(() => this.draft() !== null));
  }

  /** Not in the constructor: the required `entity` input is only set by now. */
  ngOnInit(): void {
    void this.loadNotes();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** "Una de una lista · 3" */
  protected kindSummary(field: CustomField): string {
    return isList(field.kind) ? `${KIND_LABEL[field.kind]} · ${field.options.length}` : KIND_LABEL[field.kind];
  }

  /** "Frenos, Filtros", or everywhere. */
  protected where(field: CustomField): string {
    if (!field.categoryIds.length) return 'Todas las categorías';
    const names = this.categories.byId();
    return field.categoryIds.map((id) => names.get(id)?.name ?? '').filter(Boolean).join(', ');
  }

  protected startNew(): void {
    this.error.set(null);
    this.optionText.set('');
    this.draft.set(blank());
  }

  protected startEdit(field: CustomField): void {
    this.error.set(null);
    this.optionText.set('');
    this.draft.set({ id: field.id, label: field.label, kind: field.kind, required: field.required, options: field.options.map((o) => ({ ...o })), categoryIds: [...field.categoryIds] });
  }

  protected useSuggestion(index: number): void {
    const idea = this.suggestions()[index];
    if (idea) this.draft.set({ ...blank(), label: idea.label, kind: idea.kind, options: (idea.options ?? []).map((value) => ({ value })) });
  }

  protected patch(change: Partial<Draft>): void {
    this.draft.update((d) => (d ? { ...d, ...change } : d));
  }

  protected addOption(): void {
    const text = this.optionText().trim();
    const draft = this.draft();
    if (!text || !draft) return;
    if (draft.options.some((o) => o.value.toLowerCase() === text.toLowerCase())) return this.toaster.show('Esa opción ya está en la lista.', 'info');
    this.patch({ options: [...draft.options, { value: text.slice(0, 60) }] });
    this.optionText.set('');
  }

  protected onOptionKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.addOption();
  }

  protected renameOption(index: number, event: Event): void {
    const value = this.value(event).slice(0, 60);
    this.patch({ options: this.draft()!.options.map((o, i) => (i === index ? { ...o, value } : o)) });
  }

  /** A saved option takes its answers with it when the field is saved: ask first. A new one just goes. */
  protected async removeOption(index: number): Promise<void> {
    const option = this.draft()!.options[index];
    if (option?.id) {
      const yes = await this.confirm.ask({
        title: `¿Quitar «${option.value}»?`,
        message: 'Al guardar el dato, se borra de las fichas que la tenían elegida. Si solo quieres cambiarle el nombre, escríbelo encima.',
        confirmLabel: 'Quitar opción',
        danger: true,
      });
      if (!yes) return;
    }
    this.patch({ options: this.draft()!.options.filter((_, i) => i !== index) });
  }

  protected toggleCategory(id: Id): void {
    const ids = this.draft()!.categoryIds;
    this.patch({ categoryIds: ids.includes(id) ? ids.filter((c) => c !== id) : [...ids, id] });
  }

  protected cancel(): void {
    this.draft.set(null);
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (!draft || this.saving()) return;
    const problem = this.problem(draft);
    this.error.set(problem);
    if (problem) return;
    this.saving.set(true);
    const options = isList(draft.kind) ? draft.options.map((o) => ({ ...o, value: o.value.trim() })) : [];
    const categoryIds = this.isProduct() ? draft.categoryIds : [];
    const ok = draft.id
      ? await this.data.update(draft.id, { label: draft.label.trim(), required: draft.required, options, categoryIds })
      : await this.data.create({ entity: this.entity(), label: draft.label.trim(), kind: draft.kind, required: draft.required, options: options.map((o) => o.value), categoryIds });
    this.saving.set(false);
    if (!ok) return;
    this.toaster.show(draft.id ? 'Dato guardado' : 'Dato creado');
    this.draft.set(null);
  }

  /** Taking a field away also takes away every answer given to it: say how many first. */
  protected async remove(): Promise<void> {
    const draft = this.draft();
    if (!draft?.id) return;
    const answered = this.answeredCount(draft.id);
    const where = this.isProduct() ? 'productos' : 'clientes';
    let removed = false;
    await this.confirm.ask({
      title: `¿Borrar «${draft.label}»?`,
      message: answered ? `Se borran también sus respuestas en ${answered} ${where}. No se puede deshacer.` : 'Ningún registro lo tiene respondido todavía.',
      confirmLabel: 'Borrar dato',
      danger: true,
      action: async () => {
        removed = await this.data.remove(draft.id!);
      },
    });
    if (removed) {
      this.toaster.show('Dato borrado');
      this.draft.set(null);
    }
  }

  /** Changes the notes of every customer that has one with that name: ask first, then wait on the button. */
  protected async organize(label: string): Promise<void> {
    if (this.organizing()) return;
    const count = this.notes().find((n) => n.label === label)?.count ?? 0;
    const yes = await this.confirm.ask({
      title: `¿Convertir «${label}» en un dato?`,
      message: `Se crea el dato «${label}» (o se usa el que ya tienes) y se llena en ${count} ${count === 1 ? 'cliente' : 'clientes'} con lo que tenían anotado. La nota se quita de su ficha.`,
      confirmLabel: 'Convertir en dato',
    });
    if (!yes) return;
    this.organizing.set(label);
    const moved = await this.data.organizeNotes(label).finally(() => this.organizing.set(null));
    if (moved === null) return;
    this.toaster.show(`Listo: ${moved} ${moved === 1 ? 'cliente tiene' : 'clientes tienen'} ahora el dato «${label}».`);
    await this.loadNotes();
  }

  private answeredCount(fieldId: Id): number {
    const rows = this.isProduct() ? this.inventory.products() : this.contacts.all();
    return rows.filter((row) => isAnswered(row.customValues[fieldId])).length;
  }

  private problem(draft: Draft): string | null {
    const label = draft.label.trim();
    if (!label) return 'Escribe el nombre del dato.';
    if (label.length > 40) return 'El nombre puede tener hasta 40 letras.';
    if (this.fields().some((f) => f.id !== draft.id && f.label.toLowerCase() === label.toLowerCase())) return `Ya tienes un dato llamado «${label}».`;
    if (isList(draft.kind) && !draft.options.some((o) => o.value.trim())) return 'Agrega al menos una opción a la lista.';
    if (isList(draft.kind) && draft.options.some((o) => !o.value.trim())) return 'Hay una opción vacía: escríbela o quítala.';
    return null;
  }

  private async loadNotes(): Promise<void> {
    if (this.entity() === 'contact') this.notes.set(await this.data.notes());
  }
}
