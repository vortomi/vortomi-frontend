import { required, schema, validate } from '@angular/forms/signals';
import { passwordProblem } from './password-policy';

export interface NewPassword {
  password: string;
  confirm: string;
}

export const emptyNewPassword = (): NewPassword => ({ password: '', confirm: '' });

/** Rules for choosing a password, shared by reset, invitation and profile forms. */
export const newPasswordSchema = schema<NewPassword>((path) => {
  required(path.password, { message: 'Elige una contraseña.' });
  validate(path.password, ({ value }) => {
    const problem = value() ? passwordProblem(value()) : null;
    return problem ? { kind: 'weak', message: problem } : undefined;
  });
  required(path.confirm, { message: 'Repite la contraseña.' });
  validate(path.confirm, ({ value, valueOf }) =>
    value() && value() !== valueOf(path.password) ? { kind: 'mismatch', message: 'No coincide con la contraseña.' } : undefined,
  );
});
