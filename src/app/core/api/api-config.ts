import { InjectionToken, type Provider } from '@angular/core';

/**
 * Where the panel's data comes from:
 * - 'mock': the prototype's JSON files in public/data (no server, no sign-in).
 * - 'api':  vortomi-backend, with a Supabase session.
 */
export type DataMode = 'mock' | 'api';

export interface ApiConfig {
  mode: DataMode;
  /** Base of every API call. Same origin in production (reverse proxy), proxied in development. */
  baseUrl: string;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  factory: () => ({ mode: 'mock', baseUrl: '/api' }),
});

export const provideApiConfig = (config: ApiConfig): Provider => ({ provide: API_CONFIG, useValue: config });
