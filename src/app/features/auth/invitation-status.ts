import type { Invitation } from '../../shared/api/models';

export type InvitationStatus = 'valid' | 'expired' | 'used' | 'missing';

/** A link works once and only until it expires. */
export function invitationStatus(invitation: Invitation | null | undefined, now: Date): InvitationStatus {
  if (!invitation) return 'missing';
  if (invitation.acceptedAt) return 'used';
  return new Date(invitation.expiresAt).getTime() > now.getTime() ? 'valid' : 'expired';
}
