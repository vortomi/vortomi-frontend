import { Injectable, InjectionToken, inject } from '@angular/core';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { API_CONFIG } from './api-config';
import { AccessTokenSource } from './access-token';

/**
 * Supabase Auth client, for sign-in and the session only: the panel never reads data
 * from Supabase directly (its Data API is off); data comes from vortomi-backend.
 * Supabase keeps and refreshes the session; the panel never stores tokens itself.
 */
export const SUPABASE = new InjectionToken<SupabaseClient>('SUPABASE', {
  providedIn: 'root',
  factory: () => {
    const config = inject(API_CONFIG).supabase;
    if (!config) throw new Error('Supabase is not configured (core/api/runtime-config.ts)');
    return createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'vortomi.session' },
    });
  },
});

/** The access token of the current Supabase session, refreshed by supabase-js when it is about to expire. */
@Injectable()
export class SupabaseAccessToken extends AccessTokenSource {
  private readonly supabase = inject(SUPABASE);

  override async token(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
}
