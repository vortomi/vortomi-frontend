import type { Invitation } from '../../shared/api/models';
import { invitationStatus } from './invitation-status';

const NOW = new Date('2026-10-09T10:24:00-04:00');
const base: Invitation = {
  id: 'inv_1',
  tenantId: 'ten_a',
  email: 'a@b.com',
  name: 'A',
  role: 'agent',
  invitedByUserId: 'usr_1',
  demoToken: 't',
  expiresAt: '2026-10-11T10:55:00-04:00',
  acceptedAt: null,
  createdAt: '2026-10-08T10:55:00-04:00',
};

describe('invitationStatus', () => {
  it('is valid before it expires and while unused', () => {
    expect(invitationStatus(base, NOW)).toBe('valid');
  });

  it('expires', () => {
    expect(invitationStatus({ ...base, expiresAt: '2026-10-09T10:00:00-04:00' }, NOW)).toBe('expired');
  });

  it('works only once', () => {
    expect(invitationStatus({ ...base, acceptedAt: '2026-10-09T09:00:00-04:00' }, NOW)).toBe('used');
  });

  it('reports unknown links without saying why', () => {
    expect(invitationStatus(undefined, NOW)).toBe('missing');
  });
});
