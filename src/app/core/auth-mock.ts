import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { Id } from '../shared/api/models';
import { Auth, type SignInResult } from './auth';
import { Directory } from './directory';
import { readStored, writeStored } from './storage';

interface AuthState {
  userId: Id;
  /** Super admins must pass a second factor before the session counts. */
  mfaPending: boolean;
  activeTenantId: Id | null;
}

const STORAGE_KEY = 'vortomi.auth';
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;

/**
 * Prototype sign-in. Any password works for a known, active person; the real check will be
 * Supabase Auth on the backend. What is real here is the behaviour the screens must have:
 * generic errors, temporary lock, second factor for our team.
 */
@Injectable()
export class MockAuth extends Auth {
  private readonly directory = inject(Directory);

  private readonly state = signal<AuthState | null>(readStored<AuthState>(STORAGE_KEY));
  private failedAttempts = 0;
  private lockedUntil = 0;

  override readonly userId = computed(() => {
    const state = this.state();
    return state && !state.mfaPending ? state.userId : null;
  });
  override readonly mfaPendingUserId = computed(() => {
    const state = this.state();
    return state?.mfaPending ? state.userId : null;
  });
  override readonly activeTenantId = computed(() => this.state()?.activeTenantId ?? null);

  constructor() {
    super();
    effect(() => writeStored(STORAGE_KEY, this.state()));
  }

  override restore(): Promise<void> {
    return Promise.resolve();
  }

  override async signIn(email: string, password: string): Promise<SignInResult> {
    await this.directory.loaded;
    if (Date.now() < this.lockedUntil) return 'locked';

    const user = this.directory.findUserByEmail(email);
    const hasAccess =
      !!user &&
      (user.platformRole === 'super_admin' ||
        this.directory.memberships().some((m) => m.userId === user.id && m.status === 'active'));

    if (!user || !hasAccess || password.length === 0) {
      this.failedAttempts += 1;
      if (this.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        this.failedAttempts = 0;
        this.lockedUntil = Date.now() + LOCK_MS;
        return 'locked';
      }
      return 'invalid';
    }

    this.failedAttempts = 0;
    const needsMfa = user.platformRole === 'super_admin';
    this.state.set({ userId: user.id, mfaPending: needsMfa, activeTenantId: null });
    return needsMfa ? 'mfa_required' : 'signed_in';
  }

  /** Prototype: any six digits except 000000 pass. */
  override verifySecondFactor(code: string): boolean {
    const state = this.state();
    if (!state?.mfaPending || !/^\d{6}$/.test(code) || code === '000000') return false;
    this.state.set({ ...state, mfaPending: false });
    return true;
  }

  override selectTenant(tenantId: Id | null): void {
    this.state.update((state) => (state ? { ...state, activeTenantId: tenantId } : state));
  }

  /** Accepting an invitation signs the person straight into that company. */
  override startSession(userId: Id, tenantId: Id): Promise<void> {
    this.state.set({ userId, mfaPending: false, activeTenantId: tenantId });
    return Promise.resolve();
  }

  override signOut(): void {
    this.state.set(null);
  }
}
