import { Injectable } from '@angular/core';

/**
 * Frozen "now" for the prototype, so the timestamps in public/data keep their meaning
 * (open service windows, "Hoy", "Ayer"). The real app replaces this with the system time.
 */
export const DEMO_NOW = '2026-10-09T10:24:00-04:00';

@Injectable({ providedIn: 'root' })
export class Clock {
  now(): Date {
    return new Date(DEMO_NOW);
  }
}
