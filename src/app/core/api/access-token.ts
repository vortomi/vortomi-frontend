import { Injectable } from '@angular/core';

/**
 * Where the current session's access token comes from. Port with one job: the
 * Supabase Auth adapter replaces it when sign-in is connected (phase G, part 2).
 * The token is never stored by the panel itself; Supabase's client keeps and refreshes it.
 */
// useFactory (not useClass): it runs on first injection, after NoAccessToken below exists.
@Injectable({ providedIn: 'root', useFactory: () => new NoAccessToken() })
export abstract class AccessTokenSource {
  /** The current access token, or null when nobody is signed in. */
  abstract token(): Promise<string | null>;
}

/** Prototype mode: there is no real session, so API calls go without a token. */
@Injectable()
export class NoAccessToken extends AccessTokenSource {
  override token(): Promise<string | null> {
    return Promise.resolve(null);
  }
}
