import { passwordStrength } from './password-policy';

describe('passwordStrength', () => {
  it('rates an empty password as unusable', () => {
    expect(passwordStrength('').score).toBe(0);
  });

  it('keeps short passwords weak even with mixed characters', () => {
    expect(passwordStrength('Ab1!xyz').score).toBeLessThanOrEqual(1);
  });

  it('rewards length and variety', () => {
    expect(passwordStrength('caballo azul bateria').score).toBeGreaterThanOrEqual(2);
    expect(passwordStrength('Caballo-Azul-Bateria-7').score).toBe(4);
  });

  it('does not reward one repeated character', () => {
    expect(passwordStrength('aaaaaaaaaaaaaaaa').score).toBe(0);
  });
});
