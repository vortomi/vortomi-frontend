import { InjectionToken, type Provider } from '@angular/core';

/**
 * Where the panel's data comes from:
 * - 'mock': the prototype's JSON files in public/data (no server, no sign-in).
 * - 'api':  vortomi-backend, with a Supabase session.
 */
export type DataMode = 'mock' | 'api';

/** Public values of the Supabase project: the URL and the publishable key are meant for the browser. */
export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export interface ApiConfig {
  mode: DataMode;
  /** Base of every API call. Same origin in production (reverse proxy), proxied in development. */
  baseUrl: string;
  /** Required in 'api' mode. Never put a secret key here: everything in this file reaches the browser. */
  supabase: SupabaseConfig | null;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  factory: () => ({ mode: 'mock', baseUrl: '/api', supabase: null }),
});

export const provideApiConfig = (config: ApiConfig): Provider => ({ provide: API_CONFIG, useValue: config });
