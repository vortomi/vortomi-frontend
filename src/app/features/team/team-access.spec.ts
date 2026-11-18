import { resetBlockText, teamEventLine } from './team-access';

describe('team access rules (mockup web-30)', () => {
  it('only the owner gives links; the menu says why not for each person', () => {
    expect(resetBlockText(null, false, 'Carlos')).toBe('Solo el dueño de la empresa puede hacerlo.');
    expect(resetBlockText(null, true, 'Carlos')).toBeNull();
    expect(resetBlockText('elsewhere', true, 'Valeria')).toContain('Valeria también trabaja en otra empresa');
    expect(resetBlockText('self', true, 'Laura')).toContain('Mi perfil');
    expect(resetBlockText('staff', true, 'Yornel')).toContain('consola');
  });

  it('the history names the console «Vortomi»', () => {
    expect(teamEventLine({ kind: 'reset_given', actor: null, subject: 'Carlos Ruiz', at: '' })).toMatchObject({ actor: 'Vortomi', text: 'le dio un enlace a' });
    expect(teamEventLine({ kind: 'reset_used', actor: 'Carlos Ruiz', subject: 'Carlos Ruiz', at: '' })).toMatchObject({ actor: 'Carlos Ruiz', subject: null });
  });
});
