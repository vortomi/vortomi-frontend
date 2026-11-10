import { ApiFailure } from '../../core/api/api-error';

/**
 * The console's data methods answer an error sentence (or null) instead of throwing. A confirmation
 * dialog with an `action` needs a throw to keep itself open and show the sentence: this bridges both.
 */
export function failIf(message: string | null): void {
  if (message) throw new ApiFailure(0, 'failed', message);
}
