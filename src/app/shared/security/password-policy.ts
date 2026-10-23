// Password rules shown to people. Short enough to type every day (8 is the NIST SP 800-63B
// minimum for chosen passwords); Supabase rate-limits sign-in attempts, which is what makes
// guessing impractical. No forced symbol soup; the most common passwords are refused.
export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordStrength {
  /** 0 (unusable) to 4 (very good). */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Muy buena'] as const;

/** The first ones anyone tries. Compared in lower case. */
const COMMON = new Set([
  '12345678a', 'a1234567', 'abc12345', 'abcd1234', 'password1', 'password123', 'passw0rd', 'contraseña1', 'contrasena1',
  'qwerty123', 'qwerty12', 'asdf1234', 'admin123', 'admin1234', 'welcome1', 'iloveyou1', 'venezuela1', 'vortomi1', 'vortomi123',
]);

/** Why a password cannot be used, or null when it can. The same rule the strength meter follows. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'Combina letras y al menos un número.';
  if (COMMON.has(password.toLowerCase()) || /^(.)\1+\d*$/.test(password)) return 'Es una contraseña muy común. Elige otra.';
  return null;
}

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: LABELS[0] };
  // Anything the rule refuses stays "Débil", whatever its length.
  if (passwordProblem(password)) return { score: 1, label: LABELS[1] };
  let score = 2;
  if (password.length >= 12) score += 1;
  if ((/[a-z]/.test(password) && /[A-Z]/.test(password)) || /[^\p{L}\d]/u.test(password)) score += 1;
  const clamped = Math.min(4, score) as PasswordStrength['score'];
  return { score: clamped, label: LABELS[clamped] };
}
