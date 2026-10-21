import { Injectable, inject } from '@angular/core';
import { API_CONFIG } from './api/api-config';

/**
 * Frozen "now" for the prototype, so the timestamps in public/data keep their meaning
 * (open service windows, "Hoy", "Ayer"). With real data ('api' mode) it is the system time.
 */
export const DEMO_NOW = '2026-10-09T10:24:00-04:00';

@Injectable({ providedIn: 'root' })
export class Clock {
  private readonly frozen = inject(API_CONFIG).mode === 'mock';

  now(): Date {
    return this.frozen ? new Date(DEMO_NOW) : new Date();
  }
}
