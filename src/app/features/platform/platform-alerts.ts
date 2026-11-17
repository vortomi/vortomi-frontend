// What the platform team must act on. Pure, so each rule is tested on its own.
import type { ChannelAccount, Id, Tenant } from '../../shared/api/models';

export type AlertSeverity = 'critical' | 'warning';
export type AlertKind = 'channel_disconnected' | 'access_expiring' | 'quality_low' | 'onboarding_stalled';

export interface PlatformAlert {
  id: string;
  tenantId: Id;
  tenantName: string;
  severity: AlertSeverity;
  kind: AlertKind;
  text: string;
}

const DAY_MS = 86_400_000;
const ACCESS_WARNING_DAYS = 7;
const STALLED_ONBOARDING_DAYS = 3;

const daysUntil = (iso: string, now: Date) => Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY_MS);

export function platformAlerts(tenants: Tenant[], channels: ChannelAccount[], now: Date): PlatformAlert[] {
  const alerts: PlatformAlert[] = [];
  for (const tenant of tenants) {
    if (tenant.status === 'cancelled') continue;
    const base = { tenantId: tenant.id, tenantName: tenant.name };

    const unfinished = tenant.status === 'draft' || tenant.status === 'awaiting_channel' || tenant.status === 'awaiting_owner';
    if (unfinished && -daysUntil(tenant.createdAt, now) >= STALLED_ONBOARDING_DAYS) {
      const days = -daysUntil(tenant.createdAt, now);
      alerts.push({
        ...base,
        id: `${tenant.id}:onboarding`,
        severity: 'warning',
        kind: 'onboarding_stalled',
        text:
          tenant.status === 'awaiting_owner'
            ? `El dueño todavía no conecta su número (alta de hace ${days} días). Llamarlo y hacerlo con él.`
            : `El alta quedó a medias hace ${days} días. Retomarla con el cliente.`,
      });
    }

    for (const channel of channels.filter((c) => c.tenantId === tenant.id)) {
      if (channel.status === 'disconnected') {
        alerts.push({
          ...base,
          id: `${channel.id}:disconnected`,
          severity: 'critical',
          kind: 'channel_disconnected',
          text: disconnectedText(channel),
        });
        continue;
      }
      if (channel.accessExpiresAt) {
        const days = daysUntil(channel.accessExpiresAt, now);
        if (days <= ACCESS_WARNING_DAYS) {
          alerts.push({
            ...base,
            id: `${channel.id}:access`,
            severity: days <= 0 ? 'critical' : 'warning',
            kind: 'access_expiring',
            text:
              days <= 0
                ? `El acceso al número ${channel.label} venció. Renovarlo ya.`
                : `El acceso a su cuenta de Meta vence en ${days} ${days === 1 ? 'día' : 'días'}. Renovarlo antes evita cortes.`,
          });
        }
      }
      if (channel.qualityRating === 'low') {
        alerts.push({
          ...base,
          id: `${channel.id}:quality`,
          severity: 'warning',
          kind: 'quality_low',
          text: `Calidad baja en ${channel.label}: muchos clientes la bloquean. Avisarle antes de que Meta la limite.`,
        });
      }
    }
  }
  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1));
}

/** What our team reads about a number that stopped working, by why Meta said it did. */
function disconnectedText(channel: ChannelAccount): string {
  const name = channel.label;
  switch (channel.statusReason) {
    case 'owner_disconnected':
      return `El dueño desconectó el número ${name} desde su teléfono. Sus mensajes no están entrando: llamarlo para reconectarlo.`;
    case 'number_changed':
      return `El número ${name} se registró de nuevo o cambió de teléfono y se desconectó. Hay que reconectarlo.`;
    case 'inactive':
      return `El número ${name} se desconectó porque no abrieron WhatsApp Business en el teléfono. Hay que reconectarlo.`;
    case 'banned':
      return `Meta bloqueó el número ${name}. Revisar el motivo con el cliente.`;
    case 'account_deleted':
      return `Se eliminó la cuenta de WhatsApp del número ${name}.`;
    default:
      return `Quitó nuestro acceso al número ${name}. Sus mensajes no están entrando: hay que volver a conectarlo.`;
  }
}
