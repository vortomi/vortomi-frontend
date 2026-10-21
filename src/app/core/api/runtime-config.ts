import type { ApiConfig } from './api-config';

/**
 * What this build of the panel talks to. Public values only: the publishable key is
 * designed to live in the browser (vortomi-backend checks every request on its own).
 * Switch `mode` to 'mock' to run the prototype on its sample data, without a server.
 */
export const RUNTIME_CONFIG: ApiConfig = {
  mode: 'api',
  baseUrl: '/api',
  supabase: {
    url: 'https://mfkttdlxkrxpuxgqwvpq.supabase.co',
    publishableKey: 'sb_publishable_g2_NyJ2HfwNekbTAcaSb0g_F4ghhfaP',
  },
};
