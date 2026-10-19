// Product import from a spreadsheet: one row per variant, grouped by product name.
import type { ProductVariant } from '../../shared/api/models';
import { parsePriceCents, skuError } from './inventory.rules';

export type ProductImportField = 'sku' | 'product' | 'category' | 'variant' | 'price' | 'stock' | 'ignore';

export interface ProductImportRow {
  line: number;
  sku: string;
  product: string;
  category: string;
  variant: string;
  priceCents: number | null;
  stock: number | null;
  status: 'new' | 'update' | 'error';
  message: string;
}

export const MAX_PRODUCT_ROWS = 5000;

const HINTS: Record<Exclude<ProductImportField, 'ignore'>, string[]> = {
  sku: ['sku', 'codigo', 'referencia', 'ref'],
  product: ['producto', 'nombre', 'descripcion', 'articulo'],
  category: ['categoria', 'rubro', 'linea', 'familia'],
  variant: ['variante', 'marca', 'modelo', 'presentacion', 'opcion'],
  price: ['precio', 'price', 'pvp', 'usd'],
  stock: ['existencia', 'stock', 'cantidad', 'inventario', 'unidades'],
};

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function guessProductMapping(header: string[]): ProductImportField[] {
  const used = new Set<ProductImportField>();
  return header.map((title) => {
    const key = normalize(title);
    const field = (Object.keys(HINTS) as Exclude<ProductImportField, 'ignore'>[]).find(
      (f) => !used.has(f) && HINTS[f].some((hint) => key === hint || key.startsWith(hint) || key.endsWith(hint)),
    );
    if (!field) return 'ignore';
    used.add(field);
    return field;
  });
}

/** Validates every data row without saving. Existing SKUs update price and stock. */
export function analyzeProductImport(rows: string[][], mapping: ProductImportField[], existing: ProductVariant[]): ProductImportRow[] {
  const cell = (cells: string[], field: ProductImportField) => {
    const index = mapping.indexOf(field);
    return index >= 0 ? (cells[index] ?? '').trim() : '';
  };
  const existingSkus = new Set(existing.map((v) => v.sku));
  const seen = new Map<string, number>();

  return rows.map((cells, index) => {
    const line = index + 2;
    const sku = cell(cells, 'sku').toUpperCase();
    const rawStock = cell(cells, 'stock');
    const stock = rawStock === '' ? null : Number(rawStock);
    const base = {
      line,
      sku,
      product: cell(cells, 'product'),
      category: cell(cells, 'category') || 'Sin categoría',
      variant: cell(cells, 'variant') || 'Única',
      priceCents: parsePriceCents(cell(cells, 'price')),
      stock,
    };
    const error = (message: string): ProductImportRow => ({ ...base, status: 'error', message });

    const skuProblem = skuError(sku, []);
    if (skuProblem) return error(skuProblem);
    const firstLine = seen.get(sku);
    if (firstLine) return error(`SKU repetido en el archivo (línea ${firstLine})`);
    seen.set(sku, line);
    if (base.priceCents === null) return error('Precio no válido');
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return error('La existencia debe ser un número entero, 0 o más');
    if (existingSkus.has(sku)) return { ...base, status: 'update', message: 'Ya existe: se actualizan precio y existencia' };
    if (!base.product) return error('Falta el nombre del producto');
    return { ...base, status: 'new', message: 'Nuevo' };
  });
}
