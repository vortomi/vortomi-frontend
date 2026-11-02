import type { PaymentFieldKind } from '../../shared/api/models';

// Formats of the Venezuelan payment data. Keep in sync with the server's copy
// (vortomi-backend/src/modules/payment-methods/venezuelan-formats.ts).

export interface Bank {
  code: string;
  name: string;
}

/** The banks of Venezuela, by their SUDEBAN code. */
export const BANKS: readonly Bank[] = [
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0104', name: 'Venezolano de Crédito' },
  { code: '0105', name: 'Mercantil' },
  { code: '0108', name: 'BBVA Provincial' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0115', name: 'Banco Exterior' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0134', name: 'Banesco' },
  { code: '0137', name: 'Sofitasa' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0146', name: 'Bangente' },
  { code: '0151', name: 'BFC Banco Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0157', name: 'DelSur' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0166', name: 'Banco Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'Mi Banco' },
  { code: '0171', name: 'Banco Activo' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0173', name: 'Banco Internacional de Desarrollo' },
  { code: '0174', name: 'Banplus' },
  { code: '0175', name: 'Banco Digital de los Trabajadores' },
  { code: '0177', name: 'Banfanb' },
  { code: '0178', name: 'N58 Banco Digital' },
  { code: '0191', name: 'Banco Nacional de Crédito (BNC)' },
];

/** "0134 · Banesco": what a bank datum stores. */
export const bankValue = (bank: Bank) => `${bank.code} · ${bank.name}`;

export const PHONE_PREFIXES = ['0412', '0414', '0416', '0422', '0424', '0426'] as const;

export const DOCUMENT_TYPES = [
  { value: 'J', label: 'J · Jurídico' },
  { value: 'V', label: 'V · Venezolano' },
  { value: 'E', label: 'E · Extranjero' },
  { value: 'G', label: 'G · Gobierno' },
  { value: 'P', label: 'P · Pasaporte' },
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number]['value'];

const DOCUMENT = /^(?:[VE]-\d{6,8}(?:-\d)?|[JG]-\d{8}-\d|P-[A-Z0-9]{6,15})$/;
const PHONE = /^04(?:12|14|16|22|24|26)-\d{7}$/;
const BANK_VALUES = new Set(BANKS.map(bankValue));

/** Whether a datum's value has its kind's format (free text always does). */
export function hasValidFormat(kind: PaymentFieldKind, value: string): boolean {
  switch (kind) {
    case 'bank':
      return BANK_VALUES.has(value);
    case 'document':
      return DOCUMENT.test(value);
    case 'phone':
      return PHONE.test(value);
    case 'text':
      return true;
  }
}

/** What to fix, in plain words, when a value does not have its format. */
export const FORMAT_HINT: Record<PaymentFieldKind, string> = {
  bank: 'elige el banco de la lista',
  document: 'el RIF de empresa o gobierno lleva 9 dígitos (12345678-9); la cédula, de 6 a 8',
  phone: 'el número lleva 7 dígitos después del código',
  text: '',
};

/** "0414-1234567" → its parts; a new number starts with 0414. */
export function splitPhone(value: string): { prefix: string; number: string } {
  const [prefix, number] = value.split('-');
  return PHONE_PREFIXES.includes(prefix as (typeof PHONE_PREFIXES)[number]) ? { prefix: prefix!, number: number ?? '' } : { prefix: '0414', number: '' };
}

/** Keeps the chosen code even before the number is typed (the format check then asks for it). */
export const joinPhone = (prefix: string, number: string) => `${prefix}-${number.replace(/\D/g, '').slice(0, 7)}`;

/** "J-12345678-9" → its parts; a new document starts as J (the business's RIF). */
export function splitDocument(value: string): { type: DocumentType; number: string } {
  const match = /^([JVEGP])-(.*)$/.exec(value);
  return match ? { type: match[1] as DocumentType, number: match[2]! } : { type: 'J', number: '' };
}

/** Joins a document as typed: digits only (a 9th is the check digit), or a passport's letters and digits. Keeps the letter. */
export function joinDocument(type: DocumentType, typed: string): string {
  if (type === 'P') return `P-${typed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)}`;
  const digits = typed.replace(/\D/g, '').slice(0, 9);
  return digits.length === 9 ? `${type}-${digits.slice(0, 8)}-${digits[8]}` : `${type}-${digits}`;
}

export const documentPlaceholder = (type: DocumentType) => (type === 'P' ? 'Número de pasaporte' : type === 'J' || type === 'G' ? '12345678-9' : '12345678');
