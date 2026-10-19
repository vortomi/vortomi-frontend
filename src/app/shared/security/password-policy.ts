// Password rules shown to people. Length matters most (NIST SP 800-63B); no forced symbol soup.
export const MIN_PASSWORD_LENGTH = 12;

export interface PasswordStrength {
  /** 0 (unusable) to 4 (very good). */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Muy buena'] as const;

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: LABELS[0] };
  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^\w\s]/.test(password)) score += 1;
  if (/^(.)\1+$/.test(password)) score = 0;
  // Short passwords never rate above "Débil", whatever their mix of characters.
  if (password.length < MIN_PASSWORD_LENGTH) score = Math.min(score, 1);
  const clamped = Math.min(4, score) as PasswordStrength['score'];
  return { score: clamped, label: LABELS[clamped] };
}
