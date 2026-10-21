import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { Id } from '../shared/api/models';
import { Toaster } from '../shared/ui/toaster';
import { toApiFailure } from './api/api-error';
import { SUPABASE } from './api/supabase';
import { Auth, type SignInResult } from './auth';
import { Directory } from './directory';
import { RemoteSession } from './remote/remote-session';
import { readStored, writeStored } from './storage';

const ACTIVE_TENANT_KEY = 'vortomi.activeTenant';

/**
 * Real sign-in: Supabase Auth checks the password and keeps the session; vortomi-backend
 * then says who the person is and where they may enter (/me). Errors stay generic so the
 * page never reveals whether an email has an account.
 * Second factor: pending (enrolment screens come next); the server already demands it
 * for the platform console.
 */
@Injectable()
export class SupabaseAuth extends Auth {
  private readonly supabase = inject(SUPABASE);
  private readonly remote = inject(RemoteSession);
  private readonly directory = inject(Directory);
  private readonly toaster = inject(Toaster);

  private readonly signedIn = signal<Id | null>(null);
  private readonly activeTenant = signal<Id | null>(readStored<Id>(ACTIVE_TENANT_KEY));

  override readonly userId = this.signedIn.asReadonly();
  override readonly mfaPendingUserId = computed<Id | null>(() => null);
  override readonly activeTenantId = this.activeTenant.asReadonly();

  constructor() {
    super();
    effect(() => writeStored(ACTIVE_TENANT_KEY, this.activeTenant()));
  }

  override async restore(): Promise<void> {
    try {
      const { data } = await this.supabase.auth.getSession();
      if (!data.session) return;
      const me = await this.remote.loadMe();
      this.signedIn.set(me.user.id);
      const tenantId = this.activeTenant();
      if (tenantId && me.companies.some((c) => c.tenantId === tenantId)) await this.openCompany(tenantId);
      else this.activeTenant.set(null);
    } catch {
      // Expired or revoked session, or no account: start clean on the sign-in page.
      await this.forget();
    } finally {
      this.directory.markRemoteReady();
    }
  }

  override async signIn(email: string, password: string): Promise<SignInResult> {
    const { error } = await this.supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    // Supabase answers 429 when it rate-limits repeated attempts.
    if (error) return error.status === 429 ? 'locked' : 'invalid';
    try {
      const me = await this.remote.loadMe();
      this.signedIn.set(me.user.id);
      this.activeTenant.set(null);
      return 'signed_in';
    } catch {
      // A real Supabase user we never invited: same answer as a wrong password.
      await this.forget();
      return 'invalid';
    }
  }

  override verifySecondFactor(): boolean {
    return false;
  }

  override selectTenant(tenantId: Id | null): void {
    this.activeTenant.set(tenantId);
    if (tenantId) void this.openCompany(tenantId);
  }

  /** Invitations arrive with milestone B7 (doc. 09); until then this mode has none. */
  override startSession(): void {
    return;
  }

  override signOut(): void {
    void this.forget();
  }

  private async openCompany(tenantId: Id): Promise<void> {
    try {
      await this.remote.loadCompany(tenantId);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    }
  }

  private async forget(): Promise<void> {
    this.signedIn.set(null);
    this.activeTenant.set(null);
    this.remote.clear();
    await this.supabase.auth.signOut().catch(() => undefined);
  }
}
