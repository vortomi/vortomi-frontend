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

    if ((tenant.status === 'draft' || tenant.status === 'awaiting_channel') && -daysUntil(tenant.createdAt, now) >= STALLED_ONBOARDING_DAYS) {
      alerts.push({
        ...base,
        id: `${tenant.id}:onboarding`,
        severity: 'warning',
        kind: 'onboarding_stalled',
        text: `El alta quedó a medias hace ${-daysUntil(tenant.createdAt, now)} días. Retomarla con el cliente.`,
      });
    }

    for (const channel of channels.filter((c) => c.tenantId === tenant.id)) {
      if (channel.status === 'disconnected') {
        alerts.push({
          ...base,
          id: `${channel.id}:disconnected`,
          severity: 'critical',
          kind: 'channel_disconnected',
          text: `Quitó nuestro acceso al número ${channel.label}. Sus mensajes no están entrando: hay que volver a conectarlo.`,
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
