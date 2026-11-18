import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { ApiIssuedReset, ApiPlatformTeam } from '../../shared/api/contract';
import { resetLinkOf } from '../../shared/ui/reset-link.dialog';
import type { Id } from '../../shared/api/models';

/** A console invitation link: opens the same invitation page, for our console instead of a company. */
export const platformInvitationLink = (token: string) => `${window.location.origin}/platform-invitation/${encodeURIComponent(token)}`;

/** «Staff» of the console (mockups web-22, web-28) against vortomi-backend. */
@Injectable({ providedIn: 'root' })
export class PlatformTeamRemote {
  private readonly api = inject(ApiClient);

  overview(): Promise<ApiPlatformTeam> {
    return this.api.get('platform/team');
  }

  /** The link comes back once: the server keeps only its fingerprint. */
  async invite(name: string, email: string): Promise<string> {
    const invitation = await this.api.post<{ token: string }>('platform/team/invitations', { name, email });
    return platformInvitationLink(invitation.token);
  }

  async renew(invitationId: Id): Promise<string> {
    const invitation = await this.api.post<{ token: string }>(`platform/team/invitations/${encodeURIComponent(invitationId)}/renew`, {});
    return platformInvitationLink(invitation.token);
  }

  revoke(invitationId: Id): Promise<void> {
    return this.api.delete(`platform/team/invitations/${encodeURIComponent(invitationId)}`);
  }

  /** A password link for another staff member (mockup web-30): comes back once. */
  async resetPassword(userId: Id): Promise<string> {
    const issued = await this.api.post<ApiIssuedReset>(`platform/team/admins/${encodeURIComponent(userId)}/password-reset`, {});
    return resetLinkOf(issued.token);
  }

  resetCode(userId: Id): Promise<void> {
    return this.api.post(`platform/team/admins/${encodeURIComponent(userId)}/reset-code`, {});
  }

  remove(userId: Id): Promise<void> {
    return this.api.delete(`platform/team/admins/${encodeURIComponent(userId)}`);
  }

  /** Signs the person out of one device (never the caller's current one). */
  endSession(userId: Id, sessionId: Id): Promise<void> {
    return this.api.delete(`platform/team/admins/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`);
  }

  /** Signs another person out of every device. */
  endSessions(userId: Id): Promise<{ ended: number }> {
    return this.api.delete(`platform/team/admins/${encodeURIComponent(userId)}/sessions`);
  }
}
