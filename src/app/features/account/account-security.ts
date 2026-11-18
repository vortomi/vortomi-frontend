import { Injectable, inject } from '@angular/core';
import { SUPABASE } from '../../core/api/supabase';

/** Why a password change was refused, in the person's words. */
export type PasswordChangeResult = 'ok' | 'wrong_current' | 'same' | 'weak' | 'failed';

/**
 * The person's own password, changed in Supabase Auth ('api' mode only). The current password goes
 * with it: Supabase checks it when the project requires it (Auth → «Require current password when
 * changing password»), so an open session left on another computer cannot change it alone.
 */
@Injectable({ providedIn: 'root' })
export class AccountSecurity {
  private readonly supabase = inject(SUPABASE);

  async changePassword(current: string, next: string): Promise<PasswordChangeResult> {
    const { error } = await this.supabase.auth.updateUser({ password: next, current_password: current });
    if (!error) return 'ok';
    const code = error.code ?? '';
    if (code === 'same_password') return 'same';
    if (code === 'weak_password') return 'weak';
    if (/current|credential|invalid/i.test(`${code} ${error.message}`)) return 'wrong_current';
    return 'failed';
  }
}
