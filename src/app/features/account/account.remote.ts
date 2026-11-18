import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { ApiMyProfile } from '../../shared/api/contract';

/** «Mi perfil» (mockup web-29) against vortomi-backend: always about the signed-in person. */
@Injectable({ providedIn: 'root' })
export class AccountRemote {
  private readonly api = inject(ApiClient);

  profile(): Promise<ApiMyProfile> {
    return this.api.get('me/profile');
  }

  rename(name: string): Promise<{ name: string }> {
    return this.api.put('me/name', { name });
  }

  /** One of my other devices (never the one in use). */
  endSession(sessionId: string): Promise<void> {
    return this.api.delete(`me/sessions/${encodeURIComponent(sessionId)}`);
  }

  /** Every device but this one. */
  endOtherSessions(): Promise<{ ended: number }> {
    return this.api.delete('me/sessions');
  }
}
