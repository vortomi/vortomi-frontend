import { passwordProblem, passwordStrength } from './password-policy';

describe('password rule', () => {
  it('accepts short everyday passwords with letters and a number', () => {
    for (const ok of ['panaderia24', 'Corolla2015', 'maria1990']) expect(passwordProblem(ok)).toBeNull();
  });

  it('asks for 8 characters, letters and a number', () => {
    expect(passwordProblem('ab12')).toContain('8 caracteres');
    expect(passwordProblem('soloLetras')).toContain('letras y al menos un número');
    expect(passwordProblem('12345678')).toContain('letras y al menos un número');
  });

  it('refuses the most common ones, whatever the case', () => {
    expect(passwordProblem('Password1')).toContain('muy común');
    expect(passwordProblem('aaaaaaaa1')).toContain('muy común');
  });
});

describe('passwordStrength', () => {
  it('rates an empty password as unusable and a refused one as weak', () => {
    expect(passwordStrength('').score).toBe(0);
    expect(passwordStrength('abc').score).toBe(1);
    expect(passwordStrength('password1').score).toBe(1);
  });

  it('rates an accepted password at least acceptable, and rewards length and variety', () => {
    expect(passwordStrength('maria1990').score).toBe(2);
    expect(passwordStrength('panaderia2024').score).toBe(3);
    expect(passwordStrength('Caballo-Azul-7').score).toBe(4);
  });
});
