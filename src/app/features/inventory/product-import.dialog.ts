import { Component, computed, inject, input, output, signal } from '@angular/core';
import { formatUsdCents } from '../../shared/format/money';
import { parseCsv, toCsv } from '../../shared/files/csv';
import { downloadText } from '../../shared/files/download';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { FileDrop } from '../../shared/ui/file-drop';
import { Pill } from '../../shared/ui/pill';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import { Toaster } from '../../shared/ui/toaster';
import { InventoryData } from './inventory.data';
import { MAX_PRODUCT_ROWS, type ProductImportField, analyzeProductImport, guessProductMapping } from './product-import';
import { formatQuantity } from './sale-units';

const MAX_FILE_BYTES = 2_000_000;
const LABEL: Record<ProductImportField, string> = {
  sku: 'Código (SKU)',
  product: 'Producto',
  category: 'Categoría',
  variant: 'Variante',
  price: 'Precio USD',
  stock: 'Existencia',
  unit: 'Se vende por',
  ignore: 'No importar',
};

/** Upload → map columns → review every row → confirm. Nothing is saved before the last step. */
@Component({
  selector: 'app-product-import-dialog',
  imports: [Dialog, Icon, Pill, FileDrop, SelectMenu],
  template: `
    <app-dialog title="Importar productos" [open]="open()" (closed)="close()">
      <app-file-drop label="Arrastra tu archivo CSV aquí o haz clic para elegirlo" hint="Hasta 2 MB" accept=".csv,text/csv" (picked)="onFile($event)" />
      <p class="field-hint">Una fila por versión: código, producto, categoría, variante, precio y existencia. Las filas con un código que ya existe actualizan su precio y su existencia.
        <button type="button" class="link" (click)="downloadTemplate()">Descargar plantilla</button></p>
      @if (fileError(); as message) {
        <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
      }
      @if (header().length) {
        <div class="mapping">
          @for (title of header(); track $index) {
            <div class="field">
              <span class="field-hint">«{{ title }}»</span>
              <app-select-menu [label]="'Columna ' + title" [options]="fieldOptions" [value]="mapping()[$index] ?? null" (picked)="setMapping($index, $event)" />
            </div>
          }
        </div>
        @if (missing()) {
          <div class="form-alert warn"><app-icon name="alert" />Indica qué columna tiene el código y cuál el precio.</div>
        } @else {
          <div class="summary">
            <app-pill tone="green" [dot]="true">{{ counts().new }} nuevos</app-pill>
            <app-pill tone="blue" [dot]="true">{{ counts().update }} se actualizan</app-pill>
            <app-pill [tone]="counts().error ? 'red' : 'neutral'" [dot]="true">{{ counts().error }} con errores (no se importan)</app-pill>
          </div>
          <div class="preview">
            <table class="data-table">
              <thead><tr><th>Línea</th><th>Código</th><th>Producto</th><th>Precio</th><th>Existencia</th><th>Resultado</th></tr></thead>
              <tbody>
                @for (row of analysis(); track row.line) {
                  <tr [class.row-error]="row.status === 'error'">
                    <td>{{ row.line }}</td><td>{{ row.sku || '—' }}</td><td>{{ row.product || '—' }} · {{ row.variant }}</td>
                    <td>{{ row.priceCents === null ? '—' : money(row.priceCents) }}</td><td>{{ row.stock === null ? '—' : quantity(row.stock, row.saleUnit) }}</td>
                    <td class="msg">{{ row.message }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
      <div dialog-actions class="dialog-actions">
        <button type="button" class="btn" (click)="close()"><span>Cancelar</span></button>
        <button type="button" class="btn btn--primary" [disabled]="missing() || !(counts().new + counts().update)" (click)="confirm()">
          <span>Importar {{ counts().new + counts().update }}</span>
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    :host { --dialog-width: 860px; }
    .mapping { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
    .summary { display: flex; gap: 8px; flex-wrap: wrap; }
    .preview { max-height: 280px; overflow: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .msg { font-size: 12.5px; color: var(--color-text-muted); }
    .row-error td { background: var(--color-danger-soft); }
  `,
})
export class ProductImportDialog {
  private readonly data = inject(InventoryData);
  private readonly toaster = inject(Toaster);

  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly labels = LABEL;
  protected readonly quantity = formatQuantity;
  protected readonly fieldOptions: MenuOption[] = (Object.keys(LABEL) as ProductImportField[]).map((field) => ({ value: field, label: LABEL[field] }));
  protected readonly money = formatUsdCents;
  protected readonly fileError = signal<string | null>(null);
  protected readonly header = signal<string[]>([]);
  protected readonly rows = signal<string[][]>([]);
  protected readonly mapping = signal<ProductImportField[]>([]);

  protected readonly analysis = computed(() => (this.header().length ? analyzeProductImport(this.rows(), this.mapping(), this.data.variants()) : []));
  protected readonly counts = computed(() => ({
    new: this.analysis().filter((r) => r.status === 'new').length,
    update: this.analysis().filter((r) => r.status === 'update').length,
    error: this.analysis().filter((r) => r.status === 'error').length,
  }));
  protected readonly missing = computed(() => !this.mapping().includes('sku') || !this.mapping().includes('price'));

  protected async onFile(file: File): Promise<void> {
    this.reset();
    if (file.size > MAX_FILE_BYTES) return this.fileError.set('El archivo pesa más de 2 MB. Divídelo en partes.');
    if (!/\.csv$/i.test(file.name)) return this.fileError.set('Usa un archivo .csv (en Excel: Guardar como → CSV).');
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) return this.fileError.set('El archivo no tiene filas de datos.');
    if (parsed.length - 1 > MAX_PRODUCT_ROWS) return this.fileError.set(`Máximo ${MAX_PRODUCT_ROWS} filas por archivo.`);
    this.header.set(parsed[0]!);
    this.rows.set(parsed.slice(1));
    this.mapping.set(guessProductMapping(parsed[0]!));
  }

  protected setMapping(index: number, picked: string): void {
    const value = picked as ProductImportField;
    this.mapping.update((m) => m.map((f, i) => (i === index ? value : f === value && value !== 'ignore' ? 'ignore' : f)));
  }

  protected downloadTemplate(): void {
    downloadText(
      'plantilla-inventario.csv',
      toCsv(
        ['SKU', 'Producto', 'Categoría', 'Variante', 'Precio USD', 'Existencia', 'Se vende por'],
        [
          ['FRN-BOS-COR15', 'Pastillas de freno Corolla 2015', 'Frenos', 'Bosch', '38,00', '6', 'Unidad'],
          ['TEL-LIN-BEI', 'Tela de lino', 'Telas', 'Beige', '7,50', '42,5', 'Metro'],
        ],
      ),
    );
  }

  protected confirm(): void {
    const result = this.data.applyImport(this.analysis());
    this.toaster.show(`${result.created} variantes nuevas, ${result.updated} actualizadas`);
    this.close();
  }

  protected close(): void {
    this.reset();
    this.closed.emit();
  }

  private reset(): void {
    this.fileError.set(null);
    this.header.set([]);
    this.rows.set([]);
    this.mapping.set([]);
  }
}
