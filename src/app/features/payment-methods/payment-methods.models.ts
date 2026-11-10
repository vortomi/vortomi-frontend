import type { PaymentCurrency, PaymentFieldKind, PaymentMethodType, PaymentProofRule } from '../../shared/api/models';
import type { IconName } from '../../shared/ui/icon';

/** A datum we propose for a type; the company changes or removes it. */
export interface SuggestedField {
  kind: PaymentFieldKind;
  label: string;
  placeholder?: string;
}

export type TypeGroup = 'ves' | 'usd' | 'other';

export interface MethodTypeInfo {
  type: PaymentMethodType;
  label: string;
  group: TypeGroup;
  /** "Paga en bolívares": shown under the type and in the preview. */
  paysIn: string;
  icon: IconName;
  /** Badge colour of the type. */
  color: string;
  fields: SuggestedField[];
  isNew?: boolean;
}

export const TYPE_GROUPS: { id: TypeGroup; label: string }[] = [
  { id: 'ves', label: 'Bolívares' },
  { id: 'usd', label: 'Dólares' },
  { id: 'other', label: 'Otros' },
];

const holder = (placeholder: string): SuggestedField => ({ kind: 'text', label: 'Titular', placeholder });

export const PAYMENT_TYPES: readonly MethodTypeInfo[] = [
  {
    type: 'pago_movil',
    label: 'Pago móvil',
    group: 'ves',
    paysIn: 'Paga en bolívares',
    icon: 'phone',
    color: '#0694a2',
    fields: [
      { kind: 'bank', label: 'Banco' },
      { kind: 'phone', label: 'Teléfono' },
      { kind: 'document', label: 'DNI' },
    ],
  },
  {
    type: 'transfer_national',
    label: 'Transferencia nacional',
    group: 'ves',
    paysIn: 'Paga en bolívares',
    icon: 'building',
    color: '#5850ec',
    fields: [
      { kind: 'bank', label: 'Banco' },
      holder('Ej.: Inversiones La Campiña, C.A.'),
      { kind: 'text', label: 'Número de cuenta', placeholder: '20 dígitos' },
      { kind: 'document', label: 'DNI' },
    ],
  },
  { type: 'cash_ves', label: 'Efectivo en bolívares', group: 'ves', paysIn: 'Paga en bolívares', icon: 'dollar', color: '#d03801', fields: [] },
  {
    type: 'zelle',
    label: 'Zelle',
    group: 'usd',
    paysIn: 'Paga en dólares',
    icon: 'dollar',
    color: '#7e3af2',
    fields: [{ kind: 'text', label: 'Correo o teléfono Zelle', placeholder: 'Ej.: pagos@tuempresa.com' }, holder('Nombre del titular')],
  },
  {
    type: 'paypal',
    label: 'PayPal',
    group: 'usd',
    paysIn: 'Paga en dólares',
    icon: 'dollar',
    color: '#1a56db',
    isNew: true,
    fields: [{ kind: 'text', label: 'Correo PayPal', placeholder: 'Ej.: pagos@tuempresa.com' }, holder('Nombre del titular')],
  },
  {
    type: 'binance',
    label: 'Binance Pay',
    group: 'usd',
    paysIn: 'Paga en USDT (1 USDT = 1 USD)',
    icon: 'dollar',
    color: '#c27803',
    isNew: true,
    fields: [
      { kind: 'text', label: 'Pay ID', placeholder: 'Ej.: 123456789' },
      { kind: 'text', label: 'Usuario', placeholder: 'Ej.: TuEmpresa' },
    ],
  },
  {
    type: 'transfer_international',
    label: 'Transferencia internacional',
    group: 'usd',
    paysIn: 'Paga en dólares',
    icon: 'building',
    color: '#0e7c86',
    fields: [
      { kind: 'text', label: 'Banco', placeholder: 'Ej.: Bank of America' },
      { kind: 'text', label: 'Dirección del banco' },
      holder('Nombre del titular'),
      { kind: 'text', label: 'Dirección del titular', placeholder: 'Dirección física, no apartado' },
      { kind: 'text', label: 'Número de cuenta' },
      { kind: 'text', label: 'ABA (desde EE. UU.)', placeholder: 'Ej.: 026009593' },
      { kind: 'text', label: 'SWIFT (desde otros países)', placeholder: 'Ej.: BOFAUS3N' },
      { kind: 'text', label: 'Banco intermediario', placeholder: 'Si tu banco lo pide' },
    ],
  },
  { type: 'cash_usd', label: 'Efectivo en dólares', group: 'usd', paysIn: 'Paga en dólares', icon: 'dollar', color: '#057a55', fields: [] },
  { type: 'cash_eur', label: 'Efectivo en euros', group: 'other', paysIn: 'Paga en euros', icon: 'dollar', color: '#1c64f2', fields: [] },
  { type: 'arrange', label: 'Acordar con el vendedor', group: 'other', paysIn: 'Monto en dólares', icon: 'chat', color: '#6b7280', fields: [] },
];

export const typeInfo = (type: PaymentMethodType): MethodTypeInfo => PAYMENT_TYPES.find((t) => t.type === type)!;

const CASH: ReadonlySet<PaymentMethodType> = new Set(['cash_usd', 'cash_ves', 'cash_eur']);
export const isCash = (type: PaymentMethodType) => CASH.has(type);
/** Paid in person or agreed with the seller: no reference and no receipt (the server checks it too). */
export const takesNoProof = (type: PaymentMethodType) => isCash(type) || type === 'arrange';

export const CURRENCY_BADGE: Record<PaymentCurrency, string> = { VES: 'Bs', USD: 'USD', EUR: 'EUR' };

export const REFERENCE_OPTIONS: { value: PaymentProofRule; label: string }[] = [
  { value: 'required', label: 'Obligatoria' },
  { value: 'optional', label: 'Opcional' },
];
export const RECEIPT_OPTIONS: { value: PaymentProofRule; label: string }[] = [
  { value: 'required', label: 'Obligatorio' },
  { value: 'optional', label: 'Opcional' },
  { value: 'none', label: 'No se pide' },
];

/** At most this many data per method (the server's limit). */
export const MAX_FIELDS = 12;
