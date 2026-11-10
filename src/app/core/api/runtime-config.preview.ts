import type { ApiConfig } from './api-config';

/**
 * `ng serve -c preview`: the panel on the prototype's sample data (public/data), with no server
 * and no sign-in to Supabase. For looking at screens; never deployed.
 */
export const RUNTIME_CONFIG: ApiConfig = {
  mode: 'mock',
  baseUrl: '/api',
  supabase: null,
};
