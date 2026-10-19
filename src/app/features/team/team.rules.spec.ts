import type { Membership } from '../../shared/api/models';
import { inviteError, memberChangeError, seatsUsed } from './team.rules';

const m = (userId: string, role: Membership['role'], status: Membership['status'] = 'active'): Membership => ({
  tenantId: 'ten_a',
  userId,
  role,
  status,
  channelAccountIds: [],
  canSeeOthers: false,
});

const team = [m('usr_admin', 'admin'), m('usr_agent', 'agent'), m('usr_new', 'agent', 'invited')];

describe('team rules', () => {
  it('counts pending invitations as used seats', () => {
    expect(seatsUsed(team)).toBe(3);
  });

  it('never leaves a company without an active admin', () => {
    expect(memberChangeError(team, 'usr_admin', { kind: 'role', role: 'agent' }, 'usr_x')).toContain('al menos una');
    expect(memberChangeError(team, 'usr_admin', { kind: 'remove' }, 'usr_x')).toContain('al menos una');
    expect(memberChangeError([...team, m('usr_admin2', 'admin')], 'usr_admin', { kind: 'remove' }, 'usr_x')).toBeNull();
  });

  it('does not let people remove themselves', () => {
    expect(memberChangeError(team, 'usr_agent', { kind: 'remove' }, 'usr_agent')).toContain('ti mismo');
  });

  it('blocks invitations beyond the plan or for people already in the team', () => {
    expect(inviteError(team, 'basic', null)).toContain('plan');
    expect(inviteError(team, 'team', 'usr_agent')).toContain('ya está');
    expect(inviteError(team, 'team', null)).toBeNull();
  });
});
