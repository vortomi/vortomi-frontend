import { errorMessage } from './error-messages';

/**
 * Every code vortomi-backend can answer with (src/http/domain-errors.ts and the
 * routes, as of 19 Oct 2026). When the server adds a code, add it here: the test
 * then demands its Spanish sentence, so no new error reaches a person as "Algo salió mal".
 */
const SERVER_CODES = [
  'missing_token', 'invalid_token', 'unauthorized', 'no_account', 'not_a_member', 'admin_required',
  'platform_admin_required', 'second_factor_required', 'conversation_not_found', 'contact_not_found',
  'assignee_cannot_attend', 'mention_not_member', 'service_window_closed', 'send_in_progress',
  'template_not_usable', 'invalid_template', 'template_exists', 'tag_not_found', 'tag_name_taken',
  'unknown_tag', 'quick_reply_not_found', 'shortcut_taken', 'stage_not_found', 'stage_name_taken',
  'stage_in_use', 'inventory_item_not_found', 'sku_taken', 'insufficient_stock', 'invalid_movement',
  'category_not_found', 'category_name_taken', 'category_in_use', 'variant_type_not_found', 'variant_option_not_found',
  'variant_type_name_taken', 'variant_option_taken', 'variant_option_repeated', 'variant_type_in_use',
  'variant_option_in_use', 'variant_type_locked', 'invalid_variant', 'member_not_found', 'channel_not_found',
  'unknown_channel', 'last_admin', 'cannot_disable_self', 'already_member', 'invitation_exists',
  'invitation_not_found', 'invitation_expired', 'invitation_email_mismatch', 'email_in_use',
  'company_unavailable', 'tenant_not_found', 'no_channel', 'waba_taken', 'phone_number_taken',
  'invalid_request', 'bad_request', 'internal',
];

describe('error messages', () => {
  it('has its own Spanish sentence for every code the server sends', () => {
    const generic = errorMessage('__unknown__', 400);
    expect(SERVER_CODES.filter((code) => errorMessage(code, 400) === generic)).toEqual([]);
  });

  it('falls back by status for codes it does not know', () => {
    expect(errorMessage('something_new', 401)).toContain('sesión');
    expect(errorMessage('something_new', 404)).toContain('ya no está disponible');
    expect(errorMessage('something_new', 503)).toContain('nuestro lado');
  });
});
