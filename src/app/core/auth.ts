import type { Signal } from '@angular/core';
import type { Id } from '../shared/api/models';

export type SignInResult = 'signed_in' | 'mfa_required' | 'invalid' | 'locked';

/**
 * Who is signed in and which company they are working on. Two implementations, picked by
 * the data mode (core/data-source.providers.ts): MockAuth for the prototype and
 * SupabaseAuth for real sessions. Screens and guards only know this contract.
 */
export abstract class Auth {
  /** Null until the person passed every step (password and, when required, the second factor). */
  abstract readonly userId: Signal<Id | null>;
  /** Password accepted, second factor still pending. */
  abstract readonly mfaPendingUserId: Signal<Id | null>;
  abstract readonly activeTenantId: Signal<Id | null>;

  /** Picks up a session that survived a reload. Runs once, before the first route. */
  abstract restore(): Promise<void>;
  abstract signIn(email: string, password: string): Promise<SignInResult>;
  abstract verifySecondFactor(code: string): boolean;
  abstract selectTenant(tenantId: Id | null): void;
  /** Accepting an invitation signs the person straight into that company; resolves once it is open. */
  abstract startSession(userId: Id, tenantId: Id): Promise<void>;
  abstract signOut(): void;
}
