import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Workspace } from '../../core/workspace';
import { parseCsv, toCsv } from '../../shared/files/csv';
import { downloadText } from '../../shared/files/download';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { type ImportField, MAX_IMPORT_ROWS, analyzeImport, guessMapping } from './contact-import';
import { ContactsData } from './contacts.data';

const MAX_FILE_BYTES = 1_000_000;
const FIELD_LABEL: Record<ImportField, string> = { name: 'Nombre', phone: 'Teléfono', tags: 'Etiquetas', ignore: 'No importar' };

/** Upload → map columns → review every row → confirm. Nothing is saved before the last step. */
@Component({
  selector: 'app-contact-import-dialog',
  imports: [Dialog, Icon, Pill],
  templateUrl: './contact-import.dialog.html',
  styles: `
    :host { --dialog-width: 760px; }
    .drop { display: flex; flex-direction: column; gap: 8px; border: 2px dashed #c9d1fb; background: var(--color-primary-softer);
      border-radius: var(--radius-lg); padding: 18px; align-items: flex-start; font-size: 13px; }
    .mapping { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
    .summary { display: flex; gap: 8px; flex-wrap: wrap; }
    .preview { max-height: 280px; overflow: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .preview td.msg { font-size: 12.5px; color: var(--color-text-muted); }
    .row-error td { background: #fdf6f5; }
  `,
})
export class ContactImportDialog {
  private readonly contacts = inject(ContactsData);
  protected readonly workspace = inject(Workspace);
  private readonly toaster = inject(Toaster);

  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly fieldLabels = FIELD_LABEL;
  protected readonly fields: ImportField[] = ['name', 'phone', 'tags', 'ignore'];
  protected readonly fileError = signal<string | null>(null);
  protected readonly fileName = signal<string | null>(null);
  protected readonly header = signal<string[]>([]);
  protected readonly dataRows = signal<string[][]>([]);
  protected readonly mapping = signal<ImportField[]>([]);
  protected readonly channelId = signal<string>('');

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

  protected async onFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.reset();
    if (!file) return;
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

  protected setMapping(index: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value as ImportField;
    this.mapping.update((m) => m.map((f, i) => (i === index ? value : f === value && value !== 'ignore' ? 'ignore' : f)));
  }

  protected setChannel(event: Event): void {
    this.channelId.set((event.target as HTMLSelectElement).value);
  }

  protected downloadTemplate(): void {
    downloadText('plantilla-contactos.csv', toCsv(['Nombre', 'Teléfono', 'Etiquetas'], [['María Fernández', '0424-555-0144', 'Cliente frecuente']]));
  }

  protected async confirm(): Promise<void> {
    const result = await this.contacts.applyImport(this.analysis(), this.targetChannel());
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
