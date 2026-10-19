import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from './error-messages';

/**
 * A failed API call, ready to show: `code` is the server's machine code
 * (`{ error: code }`), `message` the Spanish sentence for the person.
 */
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }

  /** The session is gone or invalid: the panel should send the person to sign in. */
  get needsSignIn(): boolean {
    return this.status === 401;
  }
}

/** Any error from an HTTP call -> ApiFailure. Network failures have status 0. */
export function toApiFailure(error: unknown): ApiFailure {
  if (error instanceof ApiFailure) return error;
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    const code = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : error.status === 0 ? 'network' : `http_${error.status}`;
    return new ApiFailure(error.status, code, errorMessage(code, error.status));
  }
  return new ApiFailure(0, 'unexpected', errorMessage('unexpected', 0));
}
