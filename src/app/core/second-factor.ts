import { Injectable, inject } from '@angular/core';
import { SUPABASE } from './api/supabase';

/** How the code is named in the authenticator app (only our team's console uses it). */
const TOTP_ISSUER = 'Vortomi';

/** Where the person stands with the authenticator-app code. */
export type SecondFactorState = 'verified' | 'needs_code' | 'not_enrolled';

export interface Enrollment {
  factorId: string;
  /** Image to scan with the authenticator app (an SVG data URL from Supabase). */
  qrCode: string;
  /** The same key as text, for typing it by hand. */
  secret: string;
}

/**
 * The second step of sign-in for our team ('api' mode): a 6-digit code from an authenticator
 * app (Google Authenticator, Microsoft Authenticator...), kept by Supabase Auth. The console
 * server demands it on every request (aal2), so a stolen password alone never opens it.
 */
@Injectable({ providedIn: 'root' })
export class SecondFactor {
  private readonly supabase = inject(SUPABASE);

  async state(): Promise<SecondFactorState> {
    const { data } = await this.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel === 'aal2') return 'verified';
    return data?.nextLevel === 'aal2' ? 'needs_code' : 'not_enrolled';
  }

  /** Starts adding the app; a half-finished attempt from before is discarded first. */
  async enroll(): Promise<Enrollment> {
    const { data: factors } = await this.supabase.auth.mfa.listFactors();
    for (const factor of factors?.all ?? []) {
      if (factor.status === 'unverified') await this.supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    // The issuer is the name the authenticator app shows; without it Supabase uses the project's Site URL.
    const { data, error } = await this.supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: TOTP_ISSUER,
      friendlyName: `Vortomi ${new Date().toISOString().slice(0, 10)}`,
    });
    if (error || !data) throw error ?? new Error('Could not start the enrolment');
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  }

  /** Checks a code against a factor; on success the session is upgraded to aal2. */
  async verify(code: string, factorId?: string): Promise<boolean> {
    const id = factorId ?? (await this.verifiedFactorId());
    if (!id) return false;
    const { error } = await this.supabase.auth.mfa.challengeAndVerify({ factorId: id, code });
    return !error;
  }

  private async verifiedFactorId(): Promise<string | null> {
    const { data } = await this.supabase.auth.mfa.listFactors();
    return data?.totp.find((factor) => factor.status === 'verified')?.id ?? null;
  }
}
