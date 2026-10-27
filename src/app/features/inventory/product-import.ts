// Product import from a spreadsheet: one row per variant, grouped by product name.
import type { ProductVariant, SaleUnit } from '../../shared/api/models';
import { parsePriceCents, skuError } from './inventory.rules';
import { SALE_UNIT, parseQuantity } from './sale-units';

export type ProductImportField = 'sku' | 'product' | 'category' | 'variant' | 'price' | 'stock' | 'unit' | 'ignore';

export interface ProductImportRow {
  line: number;
  sku: string;
  product: string;
  category: string;
  variant: string;
  priceCents: number | null;
  stock: number | null;
  /** «Se vende por»; a new product takes it, an existing one keeps its own. Empty cell: Unidad. */
  saleUnit: SaleUnit;
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
  unit: ['se vende por', 'unidad de venta', 'unidad', 'medida'],
};

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** What a spreadsheet may say for each unit: its name, plural or code ("Kilo", "kilos", "kg"). */
const UNIT_WORDS = new Map<string, SaleUnit>(
  (Object.keys(SALE_UNIT) as SaleUnit[]).flatMap((unit) => {
    const label = normalize(SALE_UNIT[unit].label);
    return [label, `${label}s`, `${label}es`, normalize(SALE_UNIT[unit].many), unit].map((word) => [word, unit] as const);
  }),
);

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
    const rawUnit = normalize(cell(cells, 'unit'));
    const saleUnit = rawUnit ? UNIT_WORDS.get(rawUnit) : 'unit';
    const rawStock = cell(cells, 'stock');
    const stock = rawStock === '' ? null : parseQuantity(rawStock, saleUnit ?? 'unit');
    const base = {
      line,
      sku,
      product: cell(cells, 'product'),
      category: cell(cells, 'category') || 'Sin categoría',
      variant: cell(cells, 'variant') || 'Única',
      priceCents: parsePriceCents(cell(cells, 'price')),
      stock,
      saleUnit: saleUnit ?? 'unit',
    };
    const error = (message: string): ProductImportRow => ({ ...base, status: 'error', message });

    const skuProblem = skuError(sku, []);
    if (skuProblem) return error(skuProblem);
    const firstLine = seen.get(sku);
    if (firstLine) return error(`SKU repetido en el archivo (línea ${firstLine})`);
    seen.set(sku, line);
    if (base.priceCents === null) return error('Precio no válido');
    if (!saleUnit) return error('Unidad de venta no reconocida: usa Unidad, Kilo, Metro, Caja…');
    if (rawStock !== '' && stock === null) return error('Existencia no válida: 0 o más, con decimales solo si se vende por peso o medida');
    if (existingSkus.has(sku)) return { ...base, status: 'update', message: 'Ya existe: se actualizan precio y existencia' };
    if (!base.product) return error('Falta el nombre del producto');
    return { ...base, status: 'new', message: 'Nuevo' };
  });
}
