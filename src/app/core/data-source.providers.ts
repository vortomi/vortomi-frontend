import { type EnvironmentProviders, type Provider, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { type ApiConfig, provideApiConfig } from './api/api-config';
import { AccessTokenSource, NoAccessToken } from './api/access-token';
import { SupabaseAccessToken } from './api/supabase';
import { Auth } from './auth';
import { MockAuth } from './auth-mock';
import { SupabaseAuth } from './auth-supabase';

/**
 * Wires the panel to its data: the prototype's JSON ('mock') or vortomi-backend with a
 * Supabase session ('api'). The only place that knows which implementation is in use.
 */
export function provideDataSource(config: ApiConfig): EnvironmentProviders {
  const api = config.mode === 'api';
  const providers: Provider[] = [
    provideApiConfig(config),
    { provide: Auth, useClass: api ? SupabaseAuth : MockAuth },
    { provide: AccessTokenSource, useClass: api ? SupabaseAccessToken : NoAccessToken },
  ];
  // A session that survived a reload is picked up before the first route is decided.
  return makeEnvironmentProviders([...providers, provideAppInitializer(() => inject(Auth).restore())]);
}
