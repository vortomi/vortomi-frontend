import { Injectable, effect, inject, signal } from '@angular/core';
import type { Id } from '../shared/api/models';
import { Toaster } from '../shared/ui/toaster';
import { toApiFailure } from './api/api-error';
import { SUPABASE } from './api/supabase';
import { Auth, type SignInResult } from './auth';
import { Directory } from './directory';
import { RemoteSession } from './remote/remote-session';
import { SecondFactor } from './second-factor';
import { readStored, writeStored } from './storage';

const ACTIVE_TENANT_KEY = 'vortomi.activeTenant';

/**
 * Our server did not answer, or failed on its side (no network, down, restarting): not the
 * person's fault, so their Supabase session is kept for when it is back.
 */
function isUnreachable(error: unknown): boolean {
  const { status } = toApiFailure(error);
  return status === 0 || status >= 500;
}

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

  private readonly secondFactor = inject(SecondFactor);

  private readonly signedIn = signal<Id | null>(null);
  /** Password accepted; the authenticator code is still missing (our team only). */
  private readonly mfaPending = signal<Id | null>(null);
  private readonly activeTenant = signal<Id | null>(readStored<Id>(ACTIVE_TENANT_KEY));

  override readonly userId = this.signedIn.asReadonly();
  override readonly mfaPendingUserId = this.mfaPending.asReadonly();
  override readonly activeTenantId = this.activeTenant.asReadonly();
  private readonly unreachable = signal(false);
  override readonly serverUnreachable = this.unreachable.asReadonly();

  constructor() {
    super();
    effect(() => writeStored(ACTIVE_TENANT_KEY, this.activeTenant()));
  }

  override async restore(): Promise<void> {
    try {
      const { data } = await this.supabase.auth.getSession();
      if (!data.session) return;
      const me = await this.remote.loadMe();
      this.unreachable.set(false);
      this.signedIn.set(me.user.id);
      const tenantId = this.activeTenant();
      if (tenantId && me.companies.some((c) => c.tenantId === tenantId)) await this.openCompany(tenantId);
      else this.activeTenant.set(null);
    } catch (error) {
      // Our server did not answer: the session stays, and the sign-in page says why.
      if (isUnreachable(error)) {
        this.unreachable.set(true);
        return;
      }
      // Expired or revoked session, or no account: start clean on the sign-in page.
      await this.forget();
    } finally {
      this.directory.markRemoteReady();
    }
  }

  override async signIn(email: string, password: string): Promise<SignInResult> {
    const { error } = await this.supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    // Supabase answers 429 when it rate-limits repeated attempts; no status or 5xx means it was not reached.
    if (error) return error.status === 429 ? 'locked' : !error.status || error.status >= 500 ? 'unavailable' : 'invalid';
    try {
      const me = await this.remote.loadMe();
      this.unreachable.set(false);
      this.activeTenant.set(null);
      // Our team with the authenticator app set up: the code comes before anything else.
      if (me.user.platformRole === 'super_admin' && (await this.secondFactor.state()) === 'needs_code') {
        this.mfaPending.set(me.user.id);
        return 'mfa_required';
      }
      this.signedIn.set(me.user.id);
      return 'signed_in';
    } catch (failure) {
      // The password was right but our server did not answer: keep the session, say so.
      if (isUnreachable(failure)) {
        this.unreachable.set(true);
        return 'unavailable';
      }
      // A real Supabase user we never invited: same answer as a wrong password.
      await this.forget();
      return 'invalid';
    }
  }

  override async verifySecondFactor(code: string): Promise<boolean> {
    const userId = this.mfaPending() ?? this.signedIn();
    if (!userId || !(await this.secondFactor.verify(code))) return false;
    this.mfaPending.set(null);
    this.signedIn.set(userId);
    return true;
  }

  override requireSecondFactor(): void {
    this.mfaPending.set(this.signedIn());
  }

  override selectTenant(tenantId: Id | null): void {
    this.activeTenant.set(tenantId);
    if (tenantId) void this.openCompany(tenantId);
  }

  /** After accepting an invitation: Supabase already holds the new session; open that company. */
  override async startSession(_userId: Id, tenantId: Id): Promise<void> {
    const me = await this.remote.loadMe();
    this.signedIn.set(me.user.id);
    this.activeTenant.set(tenantId);
    await this.openCompany(tenantId);
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
    this.mfaPending.set(null);
    this.activeTenant.set(null);
    this.remote.clear();
    await this.supabase.auth.signOut().catch(() => undefined);
  }
}
