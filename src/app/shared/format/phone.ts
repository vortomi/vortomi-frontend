// WhatsApp identifies people by their number in international digits ("584145550187", the wa_id).
// Agents type numbers the local way ("0414-555-0187"), so both directions are needed.

/** Returns the wa_id (digits with country code) or null when it cannot be a valid number. */
export function toWaId(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+') && !digits.startsWith('58')) {
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }
  let national: string;
  if (digits.startsWith('58') && digits.length === 12) national = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) national = digits.slice(1);
  else if (digits.length === 10) national = digits;
  else return null;
  // Venezuelan numbers: mobile (4xx) or landline (2xx) area codes.
  return /^[24]\d{9}$/.test(national) ? `58${national}` : null;
}

/** "584145550187" → "+58 414-555-0187" */
export function formatWaId(waId: string): string {
  if (waId.startsWith('58') && waId.length === 12) {
    return `+58 ${waId.slice(2, 5)}-${waId.slice(5, 8)}-${waId.slice(8)}`;
  }
  return `+${waId}`;
}
