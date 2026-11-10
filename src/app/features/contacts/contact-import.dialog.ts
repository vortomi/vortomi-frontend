import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Workspace } from '../../core/workspace';
import { parseCsv, toCsv } from '../../shared/files/csv';
import { downloadText } from '../../shared/files/download';
import { Confirm } from '../../shared/ui/confirm';
import { Dialog } from '../../shared/ui/dialog';
import { FileDrop } from '../../shared/ui/file-drop';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import { Toaster } from '../../shared/ui/toaster';
import { type ImportField, MAX_IMPORT_ROWS, analyzeImport, guessMapping } from './contact-import';
import { ContactsData } from './contacts.data';

const MAX_FILE_BYTES = 1_000_000;
const FIELD_LABEL: Record<ImportField, string> = { name: 'Nombre', phone: 'Teléfono', tags: 'Etiquetas', ignore: 'No importar' };

/** Upload → map columns → review every row → confirm. Nothing is saved before the last step. */
@Component({
  selector: 'app-contact-import-dialog',
  imports: [Dialog, FileDrop, Icon, Pill, SelectMenu],
  templateUrl: './contact-import.dialog.html',
  styles: `
    :host { --dialog-width: 760px; }
    .template { align-self: flex-start; font-size: 13px; }
    .mapping { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
    .summary { display: flex; gap: 8px; flex-wrap: wrap; }
    .preview { max-height: 280px; overflow: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .preview td.msg { font-size: 12.5px; color: var(--color-text-muted); }
    .row-error td { background: var(--color-danger-soft); color: var(--color-danger-text); }
  `,
})
export class ContactImportDialog {
  private readonly contacts = inject(ContactsData);
  protected readonly workspace = inject(Workspace);
  private readonly toaster = inject(Toaster);
  private readonly ask = inject(Confirm);

  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly fileError = signal<string | null>(null);
  protected readonly fileName = signal<string | null>(null);
  protected readonly header = signal<string[]>([]);
  protected readonly dataRows = signal<string[][]>([]);
  protected readonly mapping = signal<ImportField[]>([]);
  protected readonly channelId = signal<string>('');
  /** Saving the rows: the dialog waits with the circle on its button. */
  protected readonly importing = signal(false);
  protected readonly channelOptions = computed<MenuOption[]>(() =>
    this.workspace.channels().map((c) => ({ value: c.id, label: c.label + ' · ' + c.displayNumber })),
  );
  protected readonly fieldOptions: MenuOption[] = (['name', 'phone', 'tags', 'ignore'] as ImportField[]).map((f) => ({ value: f, label: FIELD_LABEL[f] }));

  protected readonly targetChannel = computed(() => this.channelId() || this.workspace.channels()[0]?.id || '');
  protected readonly analysis = computed(() =>
    this.header().length
      ? analyzeImport(this.dataRows(), this.mapping(), this.contacts.all(), this.targetChannel(), this.workspace.tags())
      : [],
  );
  protected readonly counts = computed(() => ({
    new: this.analysis().filter((r) => r.status === 'new').length,
    update: this.analysis().filter((r) => r.status === 'update').length,
    error: this.analysis().filter((r) => r.status === 'error').length,
  }));
  protected readonly missingColumns = computed(() => !this.mapping().includes('name') || !this.mapping().includes('phone'));

  protected async onFile(file: File): Promise<void> {
    this.reset();
    if (file.size > MAX_FILE_BYTES) return this.fileError.set('El archivo pesa más de 1 MB. Divídelo en partes.');
    if (!/\.csv$/i.test(file.name)) return this.fileError.set('Usa un archivo .csv (en Excel: Guardar como → CSV).');
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return this.fileError.set('El archivo no tiene filas de datos.');
    if (rows.length - 1 > MAX_IMPORT_ROWS) return this.fileError.set(`Máximo ${MAX_IMPORT_ROWS} contactos por archivo.`);
    this.fileName.set(file.name);
    this.header.set(rows[0]!);
    this.dataRows.set(rows.slice(1));
    this.mapping.set(guessMapping(rows[0]!));
  }

  protected setMapping(index: number, picked: string): void {
    const value = picked as ImportField;
    this.mapping.update((m) => m.map((f, i) => (i === index ? value : f === value && value !== 'ignore' ? 'ignore' : f)));
  }

  protected downloadTemplate(): void {
    downloadText('plantilla-contactos.csv', toCsv(['Nombre', 'Teléfono', 'Etiquetas'], [['María Fernández', '0424-555-0144', 'Cliente frecuente']]));
  }

  /** Existing contacts get overwritten: asked first, then the button waits for the server. */
  protected async importRows(): Promise<void> {
    if (this.importing()) return;
    const { new: created, update } = this.counts();
    const yes = await this.ask.ask({
      title: '¿Importar ' + (created + update) + ' contactos?',
      message: update
        ? 'Se crean ' + created + ' contactos nuevos y se actualizan ' + update + ' que ya existen con los datos del archivo.'
        : 'Se crean ' + created + ' contactos nuevos.',
      confirmLabel: 'Importar',
    });
    if (!yes) return;
    this.importing.set(true);
    let result: Awaited<ReturnType<ContactsData['applyImport']>>;
    try {
      result = await this.contacts.applyImport(this.analysis(), this.targetChannel());
    } finally {
      this.importing.set(false);
    }
    // Refused: the reason is already on screen and the dialog stays open to fix the file.
    if (!result) return;
    this.toaster.show(`${result.created} contactos nuevos, ${result.updated} actualizados`);
    this.reset();
    this.closed.emit();
  }

  protected close(): void {
    this.reset();
    this.closed.emit();
  }

  private reset(): void {
    this.fileError.set(null);
    this.fileName.set(null);
    this.header.set([]);
    this.dataRows.set([]);
    this.mapping.set([]);
  }
}
