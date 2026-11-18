import { sampleTeam } from './platform-team.sample';
import { expiryText, filterActivity, matchesPerson, staffSummary, staffWarnings } from './staff.rules';

const NOW = new Date('2026-11-18T15:00:00Z');

describe('staff rules', () => {
  it('the four figures: access, codes, sessions on distinct devices, and the latest access', () => {
    expect(staffSummary(sampleTeam(NOW))).toEqual({
      withAccess: 3,
      pendingInvitations: 1,
      withCode: 2,
      withoutCode: ['Ana Rojas'],
      sessions: 4,
      devices: 4,
      lastAccess: { name: 'Yornel Marval', at: NOW.toISOString(), device: 'Chrome en macOS' },
    });
  });

  it('warns about a missing code and an invitation about to expire', () => {
    expect(staffWarnings(sampleTeam(NOW), NOW)).toEqual(['Ana Rojas todavía no activó su código de seguridad', 'la invitación de Pedro Gómez vence pronto']);
  });

  it('invitation expiry in words', () => {
    expect(expiryText('2026-11-18T10:00:00Z', NOW)).toEqual({ text: 'Venció', tone: 'red' });
    expect(expiryText('2026-11-19T10:00:00Z', NOW)).toEqual({ text: 'Vence en menos de un día', tone: 'amber' });
    expect(expiryText('2026-11-21T16:00:00Z', NOW)).toEqual({ text: 'Vence en 4 días', tone: 'blue' });
  });

  it('activity by kind and by person', () => {
    const activity = sampleTeam(NOW).activity;
    expect(filterActivity(activity, 'numbers', null).map((a) => a.action)).toEqual(['channel.replaced']);
    expect(filterActivity(activity, 'all', 'usr_luis_staff')).toHaveLength(3);
  });

  it('search by name or email, without caring about accents', () => {
    expect(matchesPerson({ name: 'Ana Rojas', email: 'ana@x.com' }, 'ROJAS')).toBe(true);
    expect(matchesPerson({ name: 'José', email: 'j@x.com' }, 'jose')).toBe(true);
    expect(matchesPerson({ name: 'José', email: 'j@x.com' }, 'luis')).toBe(false);
  });
});
