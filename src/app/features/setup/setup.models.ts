// The welcome (block C): the company's answers and the starting point they prepare.
import type { SaleUnit, SellMethod, Sells, StockMode } from '../../shared/api/models';
import type { OptionCard } from '../../shared/ui/option-cards';

export interface SetupAnswers {
  businessType: string;
  /** Under «Otro», what the company does; empty otherwise. */
  businessTypeOther: string;
  sells: Sells;
  sellMethod: SellMethod;
}

export interface SetupStatus {
  businessType: string | null;
  businessTypeOther: string;
  sells: Sells | null;
  sellMethod: SellMethod | null;
  /** Done or skipped: the welcome no longer opens by itself. */
  completedAt: string | null;
}

/** One thing the plan would create; `exists` when the company already has it (left as it is). */
export interface PlanItem {
  name: string;
  detail: string;
  exists: boolean;
}

export interface SetupPlan {
  workMode: 'support_only' | null;
  saleDefaults: { defaultSaleUnit: SaleUnit; defaultStockMode: StockMode } | null;
  categories: PlanItem[];
  productFields: PlanItem[];
  contactFields: PlanItem[];
  variantTypes: PlanItem[];
  tags: PlanItem[];
}

export type PlanPart = 'workMode' | 'saleDefaults' | 'categories' | 'productFields' | 'contactFields' | 'variantTypes' | 'tags';

export const SELLS_OPTIONS: OptionCard[] = [
  { value: 'products', label: 'Productos', icon: 'package', hint: 'Lo que tienes en existencia' },
  { value: 'services', label: 'Servicios', icon: 'wrench', hint: 'Citas, trabajos, reparaciones' },
  { value: 'both', label: 'Productos y servicios', icon: 'layers', hint: 'Un poco de los dos' },
  { value: 'none', label: 'Nada, solo atiendo', icon: 'chat', hint: 'Consultas y soporte' },
];

export const METHOD_OPTIONS: OptionCard[] = [
  { value: 'unit', label: 'Por unidad', icon: 'box', hint: 'Piezas, cajas, docenas' },
  { value: 'weight', label: 'Por peso', icon: 'scale', hint: 'Kilos' },
  { value: 'measure', label: 'Por medida', icon: 'ruler', hint: 'Metros, litros' },
  { value: 'time', label: 'Por hora o servicio', icon: 'clock', hint: 'Lo que dura el trabajo' },
  { value: 'mixed', label: 'De varias formas', icon: 'shuffle', hint: 'Cada producto a su manera' },
];

export const PART_LABEL: Record<PlanPart, string> = {
  workMode: 'Forma de trabajo',
  saleDefaults: 'Productos nuevos',
  categories: 'Categorías',
  productFields: 'Datos de productos',
  contactFields: 'Datos de clientes',
  variantTypes: 'Variantes',
  tags: 'Etiquetas',
};
