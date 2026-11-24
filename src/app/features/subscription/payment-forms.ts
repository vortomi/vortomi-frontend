import type { PaymentFieldKind } from '../../shared/api/models';
import type { PayableMethod } from '../../shared/api/subscriptions';
import { addDays } from './subscription.rules';
import { BANKS, bankValue } from '../payment-methods/venezuelan-formats';

// The payment report form of each kind of method (documentations/18 §5, mockup web-40): what it
// asks about who paid, the format of its reference, and its messages. Keep in sync with the server's
// copy (vortomi-backend/src/modules/subscriptions/subscription-payment-forms.ts).

/** How many days back a payment may still be reported (decided 24/11/2026). */
export const REPORT_WINDOW_DAYS = 7;
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

type Check = (value: string) => boolean;

export interface PayerFieldSpec {
  key: string;
  label: string;
  /** How it is typed: a bank of the list, a mobile number, a cédula or RIF, or free text. */
  kind: PaymentFieldKind;
  hint?: string;
  placeholder?: string;
  check: Check;
  /** What to fix, when the check fails. */
  message: string;
}

export interface ReferenceSpec {
  label: string;
  hint: string;
  placeholder: string;
  numeric: boolean;
  pattern: RegExp;
  message: string;
}

export interface MethodFormSpec {
  /** «Datos de tu pago móvil». */
  title: string;
  payer: PayerFieldSpec[];
  /** null: the method has no reference (cash). */
  reference: ReferenceSpec | null;
  /** «Monto pagado», «Monto enviado», «Monto entregado». */
  amountLabel: string;
}

const NAME = /^\p{L}[\p{L}\s'.-]{2,59}$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BANK_VALUES = new Set(BANKS.map(bankValue));
const isUsPhone: Check = (v) => /^1?\d{10}$/.test(v.replace(/[\s().+-]/g, ''));
const isPhone: Check = (v) => /^\+?\d{8,15}$/.test(v.replace(/[\s().-]/g, ''));
const DOCUMENT = /^(?:[VE]-\d{6,8}(?:-\d)?|[JG]-\d{8}-\d|P-[A-Z0-9]{6,15})$/;

const bank: PayerFieldSpec = { key: 'bank', label: 'Banco desde el que pagaste', kind: 'bank', check: (v) => BANK_VALUES.has(v), message: 'Elige el banco desde el que pagaste.' };
const phone: PayerFieldSpec = {
  key: 'phone',
  label: 'Teléfono desde el que pagaste',
  kind: 'phone',
  check: (v) => /^04(?:12|14|16|22|24|26)-\d{7}$/.test(v),
  message: 'El número lleva 7 dígitos después del código.',
};
const document: PayerFieldSpec = {
  key: 'document',
  label: 'Cédula o RIF del titular',
  kind: 'document',
  check: (v) => DOCUMENT.test(v),
  message: 'La cédula lleva de 6 a 8 dígitos; el RIF de empresa o gobierno, 9.',
};
const holder: PayerFieldSpec = { key: 'holder', label: 'Titular de la cuenta', kind: 'text', placeholder: 'Nombre y apellido', check: (v) => NAME.test(v), message: 'Escribe el nombre del titular (de 3 a 60 letras).' };
const digitsReference = (hint: string): ReferenceSpec => ({
  label: 'Número de referencia',
  hint,
  placeholder: '000451287',
  numeric: true,
  pattern: /^\d{4,20}$/,
  message: 'La referencia lleva solo números (de 4 a 20).',
});

const FORMS: Record<string, MethodFormSpec> = {
  pago_movil: {
    title: 'Datos de tu pago móvil',
    payer: [bank, phone, document],
    reference: digitsReference('Completa, como sale en tu comprobante (en el Banco de Venezuela, el número de operación)'),
    amountLabel: 'Monto pagado',
  },
  transfer_national: {
    title: 'Datos de tu transferencia',
    payer: [{ ...bank, label: 'Banco desde el que transferiste' }, holder, document],
    reference: digitsReference('Solo números, como salen en tu comprobante'),
    amountLabel: 'Monto transferido',
  },
  zelle: {
    title: 'Datos de tu Zelle',
    payer: [
      { key: 'senderName', label: 'Nombre de quien envió', kind: 'text', hint: 'Como aparece en Zelle', placeholder: 'Nombre y apellido', check: (v) => NAME.test(v), message: 'Escribe el nombre de quien envió (de 3 a 60 letras).' },
      {
        key: 'senderContact',
        label: 'Correo o teléfono de Zelle de quien envió',
        kind: 'text',
        hint: 'Un correo, o un teléfono de EE. UU. de 10 dígitos',
        placeholder: 'correo@ejemplo.com',
        check: (v) => EMAIL.test(v) || isUsPhone(v),
        message: 'Escribe un correo válido o un teléfono de EE. UU. de 10 dígitos.',
      },
    ],
    reference: { label: 'Número de confirmación', hint: 'Letras y números, como lo muestra tu banco', placeholder: 'Q7K2X9M4P', numeric: false, pattern: /^[A-Z0-9]{4,30}$/, message: 'El número de confirmación lleva de 4 a 30 letras y números.' },
    amountLabel: 'Monto enviado',
  },
  binance: {
    title: 'Datos de tu pago en Binance',
    payer: [
      {
        key: 'sender',
        label: 'Binance ID, correo o teléfono de quien envió',
        kind: 'text',
        placeholder: '291004556',
        check: (v) => /^\d{6,12}$/.test(v.replace(/\s/g, '')) || EMAIL.test(v) || isPhone(v),
        message: 'Escribe el Binance ID (de 6 a 12 dígitos), un correo o un teléfono.',
      },
    ],
    reference: {
      label: 'ID de la orden',
      hint: 'En Binance: Pay → Historial → el pago → «ID de la orden». Letras y números, hasta 32',
      placeholder: '351276008817264128',
      numeric: false,
      pattern: /^[A-Z0-9]{6,32}$/,
      message: 'El ID de la orden lleva de 6 a 32 letras y números.',
    },
    amountLabel: 'Monto enviado',
  },
  paypal: {
    title: 'Datos de tu PayPal',
    payer: [{ key: 'senderEmail', label: 'Correo de PayPal de quien envió', kind: 'text', placeholder: 'correo@ejemplo.com', check: (v) => EMAIL.test(v), message: 'Escribe un correo válido.' }],
    reference: {
      label: 'ID de la transacción',
      hint: '17 letras y números (en PayPal: Actividad → el pago)',
      placeholder: '8MC585209K746392H',
      numeric: false,
      pattern: /^(?:[A-Z0-9]{17}|[A-Z0-9]{19})$/,
      message: 'El ID de PayPal lleva 17 letras y números (19 si es una orden).',
    },
    amountLabel: 'Monto enviado',
  },
  transfer_international: {
    title: 'Datos de tu transferencia',
    payer: [
      { key: 'bank', label: 'Banco desde el que transferiste', kind: 'text', placeholder: 'Bank of America', check: (v) => v.length >= 2 && v.length <= 60, message: 'Escribe el nombre del banco.' },
      holder,
    ],
    reference: { label: 'Número de referencia', hint: 'Letras y números, como salen en tu comprobante', placeholder: 'FT2611301234', numeric: false, pattern: /^[A-Z0-9-]{4,40}$/, message: 'La referencia lleva de 4 a 40 letras y números.' },
    amountLabel: 'Monto transferido',
  },
  cash_usd: {
    title: 'Datos de tu pago en efectivo',
    payer: [{ key: 'receivedBy', label: 'Quién lo recibió', kind: 'text', placeholder: 'Nombre y apellido', check: (v) => NAME.test(v), message: 'Escribe quién recibió el pago (de 3 a 60 letras).' }],
    reference: null,
    amountLabel: 'Monto entregado',
  },
};
FORMS['cash_ves'] = FORMS['cash_usd']!;

/** The form of a method companies may pay with; null for one they may not. */
export const formOf = (type: string): MethodFormSpec | null => FORMS[type] ?? null;

/** "000 451 287" → "000451287": as the bank prints it, without spaces, in capitals. */
export const normalizeReference = (text: string) => text.replace(/\s+/g, '').toUpperCase();

/**
 * An amount typed the Venezuelan way ("92.435,33", "225,15", "225.15") as the server takes it
 * ("92435.33"); null when it is not a number above 0 with at most 2 decimals.
 */
export function parseTypedAmount(text: string): string | null {
  let clean = text.replace(/[\s$]|bs\.?|usdt/gi, '');
  if (!/^[\d.,]+$/.test(clean)) return null;
  if (clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
  else if ((clean.match(/\./g) ?? []).length > 1 || /^\d{1,3}\.\d{3}$/.test(clean)) clean = clean.replace(/\./g, '');
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(clean) || Number(clean) <= 0) return null;
  return clean;
}

export interface ReportDraft {
  payer: Record<string, string>;
  reference: string;
  /** "YYYY-MM-DD", or null while it is not a real day. */
  paidOn: string | null;
  amount: string;
  proof: { name: string; size: number; mimeType: string } | null;
  /** A rejected payment already has its receipt: it stays unless a new one comes. */
  keepsProof: boolean;
}

/** What is wrong with each field of the form, by field ('payer.bank', 'reference', 'paidOn', 'amount', 'proof'). */
export function reportErrors(method: PayableMethod, draft: ReportDraft, today: string): Record<string, string> {
  const form = formOf(method.type);
  const errors: Record<string, string> = {};
  if (!form) return { method: 'Este método no está disponible para pagar tu suscripción.' };
  for (const field of form.payer) {
    const value = (draft.payer[field.key] ?? '').trim();
    if (!value || !field.check(value)) errors[`payer.${field.key}`] = field.message;
  }
  if (form.reference && method.referenceRule !== 'none') {
    const reference = normalizeReference(draft.reference);
    if (!reference && method.referenceRule === 'required') errors['reference'] = `Escribe el ${form.reference.label.toLowerCase()}.`;
    else if (reference && !form.reference.pattern.test(reference)) errors['reference'] = form.reference.message;
  }
  if (!draft.paidOn) errors['paidOn'] = 'Escribe una fecha válida (dd/mm/aaaa) o elígela en el calendario.';
  else if (draft.paidOn > today) errors['paidOn'] = 'La fecha no puede ser futura.';
  else if (draft.paidOn < addDays(today, -REPORT_WINDOW_DAYS))
    errors['paidOn'] = 'Pasaron más de 7 días desde este pago. Comunícate con un agente autorizado de Vortomi para resolverlo.';
  if (!parseTypedAmount(draft.amount)) errors['amount'] = draft.amount.trim() ? 'Escribe un monto mayor que 0, con hasta 2 decimales.' : 'Escribe el monto que pagaste.';
  if (draft.proof) {
    if (!(PROOF_TYPES as readonly string[]).includes(draft.proof.mimeType)) errors['proof'] = 'El comprobante debe ser una imagen (JPG, PNG o WebP) o un PDF.';
    else if (draft.proof.size > MAX_PROOF_BYTES) errors['proof'] = 'El archivo pesa más de 5 MB.';
  } else if (method.receiptRule === 'required' && !draft.keepsProof) errors['proof'] = 'Adjunta el comprobante de tu pago.';
  return errors;
}

/** The amount typed, in dollar cents: as is in dollars, at Vortomi's rate in bolívares; null if it cannot be told. */
export function typedUsdCents(amount: string, currency: 'USD' | 'VES', bsPerUsd: string | null): number | null {
  const parsed = parseTypedAmount(amount);
  if (!parsed) return null;
  if (currency === 'USD') return Math.round(Number(parsed) * 100);
  return bsPerUsd && Number(bsPerUsd) > 0 ? Math.round((Number(parsed) / Number(bsPerUsd)) * 100) : null;
}
