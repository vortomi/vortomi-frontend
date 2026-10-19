// Notices the company panel shows about its own numbers (decision 13 Oct: never only in our console).
import type { ChannelAccount } from '../shared/api/models';

export interface ChannelNotice {
  channelId: string;
  title: string;
  detail: string;
}

/**
 * A disconnected number receives nothing, and a restricted one can barely send: both stop the
 * company's work, so the panel says so on every screen. Who can fix it changes the advice.
 */
export function channelNotices(channels: readonly ChannelAccount[], isAdmin: boolean): ChannelNotice[] {
  const whoFixes = isAdmin ? 'Escríbenos y lo reconectamos contigo.' : 'Avísale a la administración de tu empresa.';
  return channels.flatMap((channel): ChannelNotice[] => {
    const name = `${channel.label} (${channel.displayNumber})`;
    switch (channel.status) {
      case 'disconnected':
        return [{
          channelId: channel.id,
          title: `El número ${name} no está recibiendo mensajes`,
          detail: `Se perdió el acceso a su cuenta de WhatsApp. Lo que escriban sus clientes no llega a la bandeja. ${whoFixes}`,
        }];
      case 'restricted':
        return [{
          channelId: channel.id,
          title: `Meta restringió el número ${name}`,
          detail: `Por quejas de clientes, por ahora no puede escribir primero. Puede responder a quien le escriba. ${isAdmin ? 'Revisa tus plantillas de marketing.' : 'Avísale a la administración de tu empresa.'}`,
        }];
      default:
        return [];
    }
  });
}
