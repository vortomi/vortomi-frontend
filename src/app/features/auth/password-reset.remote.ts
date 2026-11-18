import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import type { ApiResetPreview } from '../../shared/api/contract';

/** What the page of a password link found: valid, or why not. */
export type ResetLookup = { status: 'valid'; preview: ApiResetPreview } | { status: 'expired' | 'missing' | 'unavailable' };

/** Preview mode: the demo link of the sample data (/reset-password/demo-reset). */
export const DEMO_RESET_TOKEN = 'demo-reset';
const DEMO_PREVIEW: ApiResetPreview = { name: 'Carlos Ruiz', givenBy: 'Laura Méndez', companyName: 'Repuestos Andinos', staff: false, expiresAt: '2099-01-01T00:00:00Z' };

/**
 * A password link (mockup web-30), from the person's side, without a session. The password goes to
 * our server only to be handed to Supabase; the answer is the email, to sign in with it right away.
 */
@Injectable({ providedIn: 'root' })
export class PasswordResetRemote {
  private readonly api = inject(ApiClient);
  private readonly preview = inject(API_CONFIG).mode !== 'api';

  async lookup(token: string): Promise<ResetLookup> {
    if (this.preview) return token === DEMO_RESET_TOKEN ? { status: 'valid', preview: DEMO_PREVIEW } : { status: 'missing' };
    try {
      return { status: 'valid', preview: await this.api.get<ApiResetPreview>(`public/password-resets/${encodeURIComponent(token)}`) };
    } catch (error) {
      const code = toApiFailure(error).code;
      return { status: code === 'reset_expired' ? 'expired' : code === 'reset_not_found' ? 'missing' : 'unavailable' };
    }
  }

  /** Sets the password and spends the link; the email to sign in with. Preview mode: the demo account. */
  async complete(token: string, password: string): Promise<{ email: string }> {
    if (this.preview) return { email: 'carlos@repuestosandinos.com' };
    return this.api.post<{ email: string }>(`public/password-resets/${encodeURIComponent(token)}`, { password });
  }
}
