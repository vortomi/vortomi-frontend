// Display-only view of Meta's 24 h service window. The backend is the one that enforces it;
// the panel just tells the agent whether a free-form reply is possible.
import type { IsoDate } from '../../shared/api/models';

export interface ServiceWindow {
  isOpen: boolean;
  remainingMs: number;
}

export function getServiceWindow(expiresAt: IsoDate | null, now: Date): ServiceWindow {
  if (!expiresAt) return { isOpen: false, remainingMs: 0 };
  const remainingMs = new Date(expiresAt).getTime() - now.getTime();
  return remainingMs > 0 ? { isOpen: true, remainingMs } : { isOpen: false, remainingMs: 0 };
}

/** "23 h 51 min", "45 min" or "menos de 1 min". */
export function formatRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return 'menos de 1 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}
