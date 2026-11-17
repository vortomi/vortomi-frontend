// Notices the company panel shows about its own numbers (decision 13 Oct: never only in our console).
import type { ChannelAccount } from '../shared/api/models';

export interface ChannelNotice {
  channelId: string;
  title: string;
  detail: string;
}

/** The connection with Meta ends this close: warned on every screen too (the number's card says it earlier). */
const EXPIRY_NOTICE_DAYS = 7;
const DAY_MS = 24 * 3_600_000;

/**
 * A disconnected number receives nothing, and a restricted one can barely send: both stop the
 * company's work, so the panel says so on every screen, with why (Meta's account_update) and who
 * can fix it. A connection about to expire is said the same way, before it stops.
 */
export function channelNotices(channels: readonly ChannelAccount[], isAdmin: boolean, now: Date = new Date()): ChannelNotice[] {
  const reconnect = isAdmin
    ? 'Reconéctalo en «Canales y equipo» con «Conectar con WhatsApp», o escríbenos y lo hacemos contigo.'
    : 'Avísale a la administración de tu empresa.';
  const askUs = isAdmin ? 'Escríbenos y lo revisamos contigo.' : 'Avísale a la administración de tu empresa.';
  return channels.flatMap((channel): ChannelNotice[] => {
    const name = `${channel.label} (${channel.displayNumber})`;
    const notice = (title: string, detail: string): ChannelNotice[] => [{ channelId: channel.id, title, detail }];
    const stopped = 'El agente ya no responde y lo que escriban tus clientes no llega a la bandeja.';

    if (channel.status === 'disconnected') {
      switch (channel.statusReason) {
        case 'owner_disconnected':
          return notice(`El número ${name} se desconectó de Vortomi desde el teléfono`, `${stopped} ${reconnect}`);
        case 'number_changed':
          return notice(`El número ${name} se registró de nuevo o cambió de teléfono`, `Eso lo desconectó de Vortomi. ${stopped} ${reconnect}`);
        case 'inactive':
          return notice(
            `El número ${name} se desconectó por no abrir WhatsApp Business`,
            `WhatsApp corta la conexión si la app del teléfono no se abre por varios días. ${stopped} ${reconnect}`,
          );
        case 'banned':
          return notice(`Meta bloqueó el número ${name}`, `No puede enviar ni recibir mensajes. Revisa el aviso que Meta envió a la empresa. ${askUs}`);
        case 'account_deleted':
          return notice(`Se eliminó la cuenta de WhatsApp del número ${name}`, `${stopped} ${askUs}`);
        default:
          return notice(`El número ${name} no está recibiendo mensajes`, `Se perdió el acceso a su cuenta de WhatsApp. ${stopped} ${reconnect}`);
      }
    }

    if (channel.status === 'restricted') {
      return channel.statusReason === 'ban_scheduled'
        ? notice(`Meta va a bloquear el número ${name}`, `Recibió muchas quejas o reportes. Revisa el aviso que Meta envió a la empresa cuanto antes. ${askUs}`)
        : notice(
            `Meta restringió el número ${name}`,
            `Por quejas de clientes, por ahora no puede escribir primero. Puede responder a quien le escriba. ${isAdmin ? 'Revisa tus plantillas de marketing.' : 'Avísale a la administración de tu empresa.'}`,
          );
    }

    if (channel.accessExpiresAt) {
      const days = Math.ceil((new Date(channel.accessExpiresAt).getTime() - now.getTime()) / DAY_MS);
      if (days <= 0) return notice(`La conexión del número ${name} con Meta venció`, `El agente no puede responder por este número. ${reconnect}`);
      if (days <= EXPIRY_NOTICE_DAYS) {
        return notice(
          `La conexión del número ${name} con Meta vence en ${days} ${days === 1 ? 'día' : 'días'}`,
          isAdmin ? 'Reconéctalo antes en «Canales y equipo» para que el agente siga respondiendo.' : 'Avísale a la administración de tu empresa.',
        );
      }
    }
    return [];
  });
}
