import { minLength, required, schema, validate } from '@angular/forms/signals';
import { MIN_PASSWORD_LENGTH, passwordStrength } from './password-policy';

export interface NewPassword {
  password: string;
  confirm: string;
}

export const emptyNewPassword = (): NewPassword => ({ password: '', confirm: '' });

/** Rules for choosing a password, shared by reset, invitation and profile forms. */
export const newPasswordSchema = schema<NewPassword>((path) => {
  required(path.password, { message: 'Elige una contraseña.' });
  minLength(path.password, MIN_PASSWORD_LENGTH, { message: `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
  validate(path.password, ({ value }) =>
    value().length >= MIN_PASSWORD_LENGTH && passwordStrength(value()).score < 2
      ? { kind: 'weak', message: 'Es fácil de adivinar. Prueba con una frase más larga.' }
      : undefined,
  );
  required(path.confirm, { message: 'Repite la contraseña.' });
  validate(path.confirm, ({ value, valueOf }) =>
    value() && value() !== valueOf(path.password) ? { kind: 'mismatch', message: 'No coincide con la contraseña.' } : undefined,
  );
});
