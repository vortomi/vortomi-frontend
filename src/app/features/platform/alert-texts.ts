// The words of each alert (mockup web-25): what is happening, what to do and since when. The
// server sends facts; every sentence our team reads is written here.
import { formatListStamp } from '../../shared/format/date-time';
import type { AlertCategory, PlatformAlert } from './platform-alerts';

/** Our team's clock: the console reads in Venezuela's time. */
const ZONE = 'America/Caracas';

export interface AlertCopy {
  title: string;
  text: string;
  todo: string;
  /** A direct way to act, when one exists in the console. */
  action: { label: string; link: string[] } | null;
}

export const CATEGORY_LABEL: Record<Exclude<AlertCategory, 'platform'>, string> = {
  connection: 'Conexión con WhatsApp',
  agent: 'Agente de ventas',
  usage: 'Consumo',
  onboarding: 'Altas',
};

const num = (value: number) => new Intl.NumberFormat('es-VE').format(value);
const fact = (alert: PlatformAlert, key: string) => alert.facts[key] ?? null;
const n = (alert: PlatformAlert, key: string) => Number(fact(alert, key) ?? 0);
const s = (alert: PlatformAlert, key: string) => String(fact(alert, key) ?? '');

/** Why Meta says a number stopped working, as our team says it. */
const DISCONNECTED: Record<string, string> = {
  owner_disconnected: 'El dueño lo desconectó desde su teléfono.',
  number_changed: 'El número se registró de nuevo o cambió de teléfono.',
  inactive: 'No abrieron WhatsApp Business en el teléfono durante 14 días.',
  access_removed: 'Quitaron nuestro acceso a su cuenta de WhatsApp.',
  banned: 'Meta bloqueó el número.',
  ban_scheduled: 'Meta anunció que va a bloquear el número.',
  restricted: 'Meta restringió el número.',
  account_deleted: 'Se eliminó su cuenta de WhatsApp.',
};

export function alertCopy(alert: PlatformAlert): AlertCopy {
  const number = alert.channelLabel ? `el número ${alert.channelLabel}` : 'su número';
  const company = alert.tenantId ? ['/platform/tenants', alert.tenantId] : null;
  switch (alert.kind) {
    case 'webhooks_failed':
      return {
        title: 'Mensajes de WhatsApp que no se pudieron procesar',
        text: `${num(n(alert, 'count'))} ${n(alert, 'count') === 1 ? 'aviso de Meta falló' : 'avisos de Meta fallaron'} en todos los intentos${fact(alert, 'lastError') ? ` (último error: «${s(alert, 'lastError')}»)` : ''}. Los mensajes de clientes que traían no aparecen en la Bandeja.`,
        todo: 'revisar los registros de Railway a esa hora y avisar a la empresa afectada.',
        action: null,
      };
    case 'unroutable_number':
      return {
        title: 'Mensajes de un número que no es de ninguna empresa',
        text: `Meta mandó ${num(n(alert, 'count'))} ${n(alert, 'count') === 1 ? 'aviso' : 'avisos'} de ${s(alert, 'key')}, que no está en Vortomi. Esos mensajes no le llegan a nadie.`,
        todo: 'buscar de qué empresa es ese número y conectarlo, o desconectarlo de nuestra app en Meta.',
        action: null,
      };
    case 'bcv_unread': {
      const rate = fact(alert, 'rate') ? ` (${num(Number(fact(alert, 'rate')))} Bs, del ${s(alert, 'effectiveDate')})` : '';
      return {
        title: 'La tasa del BCV no se pudo leer',
        text: `Último intento: «${s(alert, 'error')}». ${n(alert, 'companies') === 1 ? 'La empresa que usa' : `Las ${n(alert, 'companies')} empresas que usan`} esa tasa siguen con la última leída${rate}.`,
        todo: 'si sigue así, avisarles que la pongan a mano en Ajustes → Tasa de cambio.',
        action: null,
      };
    }
    case 'channel_disconnected':
      return {
        title: `${capital(number)} está desconectado`,
        text: `${DISCONNECTED[s(alert, 'reason')] ?? 'Ya no tenemos acceso a él.'} Sus mensajes no están entrando a Vortomi.`,
        todo: s(alert, 'reason') === 'banned' ? 'revisar con el cliente el motivo del bloqueo en Meta.' : 'llamarlo para que pulse «Reconectar con WhatsApp» en su panel.',
        action: company && { label: 'Ver el número', link: company },
      };
    case 'access_expired':
      return {
        title: `El acceso a ${number} venció`,
        text: 'Ya no puede enviar ni recibir mensajes.',
        todo: 'pedirle que pulse «Reconectar con WhatsApp», o poner una clave nueva en «Cambiar número o clave».',
        action: company && { label: 'Cambiar clave', link: company },
      };
    case 'access_expiring':
      return {
        title: `El acceso a su cuenta de Meta vence en ${n(alert, 'days')} ${n(alert, 'days') === 1 ? 'día' : 'días'}`,
        text: `Al vencer, ${number} deja de enviar y recibir mensajes.`,
        todo: 'pedirle que pulse «Reconectar con WhatsApp», o poner una clave nueva en «Cambiar número o clave».',
        action: company && { label: 'Cambiar clave', link: company },
      };
    case 'number_silent':
      return {
        title: `${capital(number)} no recibe mensajes hace más de 7 días`,
        text: `Está conectado, pero ningún cliente le escribe. ${n(alert, 'perDay') >= 1 ? `Antes recibía unos ${num(n(alert, 'perDay'))} al día.` : 'Antes sí recibía.'}`,
        todo: 'escribirle de prueba al número y llamar a la empresa si no llega.',
        action: null,
      };
    case 'agent_cap_reached':
      return {
        title: 'El agente se quedó sin respuestas del mes',
        text: `Usó sus ${num(n(alert, 'cap'))} respuestas del mes: desde ahí pasa cada conversación a una persona.`,
        todo: 'avisarle que hasta el próximo mes responde su equipo. El cupo hoy es el mismo para todas las empresas.',
        action: null,
      };
    case 'agent_cap_near':
      return {
        title: 'El agente está cerca de su límite del mes',
        text: `Lleva ${num(n(alert, 'replies'))} de ${num(n(alert, 'cap'))} respuestas. Al llegar al límite, todo pasa a una persona.`,
        todo: 'avisarle para que su equipo esté atento a la Bandeja los próximos días.',
        action: null,
      };
    case 'catalog_unavailable':
      return {
        title: 'Su catálogo no responde',
        text: `El agente no pudo leer los productos de su sistema y pasó ${num(n(alert, 'conversations'))} ${n(alert, 'conversations') === 1 ? 'conversación' : 'conversaciones'} a una persona en las últimas 24 h.`,
        todo: 'avisar a su encargado de sistemas: el problema es de su sistema, no del nuestro.',
        action: null,
      };
    case 'free_replies_exceeded':
      return {
        title: `Pasó las ${num(n(alert, 'free'))} respuestas gratis de Meta`,
        text: `${capital(number)} lleva ${num(n(alert, 'replies'))} respuestas este mes: desde la ${num(n(alert, 'free') + 1)}, Meta cobra cada una a la tarjeta de la empresa.`,
        todo: 'confirmar que tiene un método de pago en Meta; sin él, Meta deja de entregar mensajes.',
        action: { label: 'Ver consumo', link: ['/platform/usage'] },
      };
    case 'onboarding_stalled':
      return n(alert, 'waitingOwner')
        ? {
            title: 'El dueño todavía no conecta su número',
            text: `El alta se hizo hace ${n(alert, 'days')} días y la empresa sigue esperando su número.`,
            todo: 'llamarlo y conectarlo con él.',
            action: company && { label: 'Abrir el alta', link: company },
          }
        : {
            title: 'El alta quedó a medias',
            text: `Se empezó hace ${n(alert, 'days')} días y no se terminó.`,
            todo: 'retomarla con el cliente, o descartar el borrador.',
            action: company && { label: 'Abrir el alta', link: company },
          };
  }
}

/** «desde hace 2 h», «desde ayer», «vence el 23 nov». */
export function sinceText(alert: PlatformAlert, now: Date): string {
  if (!alert.since) return '';
  const at = new Date(alert.since);
  if (alert.kind === 'access_expiring') return `vence el ${formatListStamp(alert.since, new Date(0), ZONE)}`;
  const minutes = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000));
  if (minutes < 60) return `desde hace ${Math.max(1, minutes)} min`;
  if (minutes < 24 * 60) return `desde hace ${Math.round(minutes / 60)} h`;
  const stamp = formatListStamp(alert.since, now, ZONE);
  return stamp === 'Ayer' ? 'desde ayer' : `desde el ${stamp}`;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
