import { Injectable, inject } from '@angular/core';
import { Auth } from '../../core/auth';
import { Clock } from '../../core/clock';
import { Directory } from '../../core/directory';
import type { Invitation } from '../../shared/api/models';
import { newId } from '../../shared/api/mock-db';

/** Turns an invitation into an active member and opens their session. In production: one backend transaction. */
@Injectable({ providedIn: 'root' })
export class InvitationAcceptance {
  private readonly directory = inject(Directory);
  private readonly auth = inject(Auth);
  private readonly clock = inject(Clock);

  accept(invitation: Invitation, name: string): void {
    const now = this.clock.now().toISOString();
    const existing = this.directory.findUserByEmail(invitation.email);
    const userId = existing?.id ?? newId('usr');

    if (existing) this.directory.updateUser(userId, { name });
    else this.directory.addUser({ id: userId, name, email: invitation.email, platformRole: null });

    const previous = this.directory.memberships().find((m) => m.tenantId === invitation.tenantId && m.userId === userId);
    this.directory.upsertMembership({
      tenantId: invitation.tenantId,
      userId,
      role: invitation.role,
      status: 'active',
      channelAccountIds: previous?.channelAccountIds ?? [],
      canSeeOthers: previous?.canSeeOthers ?? invitation.role === 'admin',
    });
    this.directory.updateInvitation(invitation.id, { acceptedAt: now });
    this.directory.record({
      id: newId('aud'),
      tenantId: invitation.tenantId,
      actorUserId: userId,
      action: 'invitation.accepted',
      detail: `${invitation.email} aceptó la invitación`,
      createdAt: now,
    });
    void this.auth.startSession(userId, invitation.tenantId);
  }
}
