import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import { toApiFailure } from '../../core/api/api-error';
import { SUPABASE } from '../../core/api/supabase';
import { Auth } from '../../core/auth';
import type { ApiInvitationPreview } from '../../shared/api/contract';

export type InvitationLookup = { status: 'valid'; preview: ApiInvitationPreview } | { status: 'expired' | 'missing' };

/**
 * Invitations against vortomi-backend ('api' mode), from the invited person's side.
 * Their password goes only to Supabase (as at sign-in); the server then checks the link and
 * that the signed-in email is the invited one, and only then lets them into the company.
 */
@Injectable({ providedIn: 'root' })
export class InvitationRemote {
  private readonly api = inject(ApiClient);
  private readonly supabase = inject(SUPABASE);
  private readonly auth = inject(Auth);

  async lookup(token: string): Promise<InvitationLookup> {
    try {
      const preview = await this.api.get<ApiInvitationPreview>(`public/invitations/${encodeURIComponent(token)}`);
      if (new Date(preview.expiresAt).getTime() < Date.now()) return { status: 'expired' };
      return { status: 'valid', preview };
    } catch (error) {
      return { status: toApiFailure(error).code === 'invitation_expired' ? 'expired' : 'missing' };
    }
  }

  /**
   * Creates the account (or signs in, when the email already has one), accepts and opens the
   * company. Resolves to what to tell the person when something stops it, or null when inside.
   */
  async accept(token: string, preview: ApiInvitationPreview, password: string, name: string): Promise<string | null> {
    const email = preview.email;
    if (preview.hasAccount) {
      const { error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) return error.status === 429 ? 'Demasiados intentos. Espera unos minutos.' : 'La contraseña no es correcta.';
    } else {
      const { data, error } = await this.supabase.auth.signUp({ email, password });
      if (error) return /registered|exists/i.test(error.message) ? 'Ese correo ya tiene cuenta. Recarga la página para entrar con tu contraseña.' : 'No se pudo crear la cuenta. Inténtalo de nuevo.';
      // Projects that ask to confirm the email first: the person confirms, then opens this link again.
      if (!data.session) return 'Te enviamos un correo para confirmar tu cuenta. Confírmala y vuelve a abrir este enlace.';
    }
    try {
      const { tenantId } = await this.api.post<{ tenantId: string }>(`invitations/${encodeURIComponent(token)}/accept`, { name });
      const { data } = await this.supabase.auth.getUser();
      await this.auth.startSession(data.user?.id ?? '', tenantId);
      return null;
    } catch (error) {
      // Not let in: no half-open session stays behind.
      await this.supabase.auth.signOut().catch(() => undefined);
      return toApiFailure(error).message;
    }
  }
}
