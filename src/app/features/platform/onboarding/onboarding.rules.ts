// Pure rules of the company sign-up (documentations/03-alta-de-empresas.md).
import type { ChannelAccount, DisplayNameStatus, Id } from '../../../shared/api/models';
export { slugify } from '../../../shared/format/slug';

/** Prototype: the WhatsApp account id that "exists" in Meta and has a free number. */
export const DEMO_NEW_WABA_ID = '300000000000001';

/** Meta's messaging limit for a business portfolio that is not verified (shared by all its numbers). */
export const UNVERIFIED_MESSAGING_LIMIT = 250;

export interface WabaNumber {
  phoneNumberId: string;
  displayNumber: string;
  /** Display name customers see, and Meta's review of it. */
  verifiedName: string;
  nameStatus: DisplayNameStatus;
  /** Company that already owns this number on the platform, if any. */
  takenBy: string | null;
}

/** What Meta reports about the customer's account, besides its numbers. */
export interface WabaAccount {
  businessVerified: boolean;
  hasPaymentMethod: boolean;
}

export type WabaLookup = { status: 'found'; account: WabaAccount; numbers: WabaNumber[] } | { status: 'not_found' };

/**
 * Simulates asking Meta for the numbers of a WhatsApp account and checks them against the
 * platform. A number already used by another company can never be connected again: the
 * backend guarantees it with a UNIQUE constraint on phone_number_id.
 */
export function classifyWabaLookup(
  wabaId: string,
  channels: ChannelAccount[],
  tenantNames: Map<Id, string>,
  companyName: string,
): WabaLookup {
  const id = wabaId.replace(/\D/g, '');
  const existing = channels.filter((c) => c.wabaId === id);
  if (existing.length) {
    return {
      status: 'found',
      account: { businessVerified: true, hasPaymentMethod: true },
      numbers: existing.map((c) => ({
        phoneNumberId: c.phoneNumberId,
        displayNumber: c.displayNumber,
        verifiedName: tenantNames.get(c.tenantId) ?? c.label,
        nameStatus: 'approved',
        takenBy: tenantNames.get(c.tenantId) ?? 'otra empresa',
      })),
    };
  }
  if (id === DEMO_NEW_WABA_ID) {
    const taken = channels.some((c) => c.phoneNumberId === '100000000000101');
    return {
      status: 'found',
      // A brand-new customer: not verified yet, no card in Meta, display name still in review.
      account: { businessVerified: false, hasPaymentMethod: false },
      numbers: [
        {
          phoneNumberId: '100000000000101',
          displayNumber: '+58 424-555-0133',
          verifiedName: shortName(companyName),
          nameStatus: 'pending_review',
          takenBy: taken ? 'otra empresa' : null,
        },
      ],
    };
  }
  return { status: 'not_found' };
}

/** "Pastelería Dulce Hogar" → "Dulce Hogar": what Meta shows as the display name. */
function shortName(companyName: string): string {
  const words = companyName.trim().split(/\s+/);
  return words.length > 2 ? words.slice(1).join(' ') : companyName.trim();
}

/** Empty, or a full link: Meta only accepts websites that start with http:// or https://. */
export const WEBSITE = /^$|^https?:\/\/\S+\.\S+$/;

/** Meta's limits for the WhatsApp profile of a number. */
export const PROFILE_ABOUT_MAX = 139;
export const PROFILE_ADDRESS_MAX = 256;

const RIF = /^([JVEGPC])(\d{8})(\d)$/;

/**
 * Venezuelan RIF as people type it ("j 41234567 8", "J-41.234.567-8") → "J-41234567-8".
 * Only the shape is checked; whether it exists is confirmed against the company's documents.
 */
export function normalizeTaxId(text: string): string | null {
  const match = RIF.exec(text.toUpperCase().replace(/[\s.\-]/g, ''));
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export type CheckOutcome = 'ok' | 'warn';

export interface CheckResult {
  title: string;
  detail: string;
  outcome: CheckOutcome;
}

/**
 * What the console verifies when it connects a number. Blocking problems never get here (no access,
 * number of another company); these are the ones a company can go live with, plus what passed.
 */
export function connectionChecks(account: WabaAccount, number: WabaNumber): CheckResult[] {
  const ok = (title: string, detail: string): CheckResult => ({ title, detail, outcome: 'ok' });
  const warn = (title: string, detail: string): CheckResult => ({ title, detail, outcome: 'warn' });
  const name = `«${number.verifiedName}»`;
  return [
    ok('Tenemos acceso a su cuenta de WhatsApp', 'Compartida desde su Meta Business, con control total'),
    ok('El número pertenece a esa cuenta', 'Lo confirma Meta; no se escribe a mano'),
    ok('El número no está en otra empresa', 'Ningún otro cliente de la plataforma lo usa'),
    ok('Número registrado con su PIN', 'Verificación en dos pasos activa'),
    ok('Sus avisos llegarán a nuestro servidor', 'Nuestra app quedó suscrita a esa cuenta'),
    ok('Perfil de WhatsApp enviado a Meta', 'Descripción, categoría, foto y datos de contacto'),
    ok('Acceso guardado cifrado', 'Nadie puede verlo, tampoco desde esta consola'),
    number.nameStatus === 'approved'
      ? ok(`Nombre visible ${name} aprobado`, 'Es el nombre que ven sus clientes')
      : number.nameStatus === 'pending_review'
        ? warn(`Nombre visible ${name} en revisión de Meta`, 'Cuando lo apruebe, Meta nos avisa y lo aplicamos sin hacer nada más.')
        : warn(`Meta rechazó el nombre ${name}`, 'Hay que proponer otro en su WhatsApp Manager, parecido al nombre del negocio.'),
    account.businessVerified
      ? ok('Negocio verificado en Meta', 'Puede subir de límite de mensajes según su uso')
      : warn(
          'Su negocio no está verificado en Meta',
          `Puede escribir primero a ${UNVERIFIED_MESSAGING_LIMIT} clientes por día entre todos sus números. Verificarlo con su RIF es la vía para subir. Se puede seguir.`,
        ),
    account.hasPaymentMethod
      ? ok('Método de pago en Meta', 'Las plantillas y las respuestas que pasen de las gratis se cobran ahí')
      : warn(
          'Falta el método de pago en Meta',
          'Puede recibir y responder dentro de las 1.000 respuestas gratis del mes por número; las plantillas no salen. Se puede seguir y pedírselo después.',
        ),
  ];
}
