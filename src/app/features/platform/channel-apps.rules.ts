// Who receives a number's messages (mockup web-31): the server reads it from Meta every 15 minutes
// and the console shows it on each number's card, our apps apart from any foreign one.
import type { ApiChannelApps } from '../../shared/api/contract';
import { timeAgo } from './tenant-list.rules';

/** Vortomi's own app: the preview, without a server, shows it alone on every number. */
export const VORTOMI_APP = { id: '1167128472338629', name: 'Vortomi' } as const;

/** When the apps were last read, or that Meta did not answer the last time. */
export function appsCheckedText(watched: ApiChannelApps, now: Date): string {
  const failedLast = watched.appsFailedAt && (!watched.appsCheckedAt || Date.parse(watched.appsFailedAt) > Date.parse(watched.appsCheckedAt));
  if (failedLast) return `No se pudo revisar · último intento ${timeAgo(watched.appsFailedAt!, now)}`;
  if (watched.appsCheckedAt) return `Revisado ${timeAgo(watched.appsCheckedAt, now)}`;
  return 'Todavía no se ha revisado';
}

/** Ours first, then the foreign ones by when they appeared. */
export function sortedApps(watched: ApiChannelApps) {
  return [...(watched.apps ?? [])].sort((a, b) => Number(b.ours) - Number(a.ours) || a.firstSeenAt.localeCompare(b.firstSeenAt));
}

/** The preview's reading: just our app, read a few minutes ago. */
export function sampleChannelApps(now: Date): ApiChannelApps {
  const checked = new Date(now.getTime() - 4 * 60_000).toISOString();
  return { apps: [{ ...VORTOMI_APP, ours: true, firstSeenAt: '2026-11-17T17:36:00Z' }], appsCheckedAt: checked, appsFailedAt: null };
}
