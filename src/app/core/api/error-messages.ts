// What the person reads for each error code the server sends (vortomi-backend,
// src/http/domain-errors.ts and the routes). Codes stay English; sentences are Spanish.

const MESSAGES: Record<string, string> = {
  // Session and access
  missing_token: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  invalid_token: 'Tu sesión venció. Vuelve a iniciar sesión.',
  unauthorized: 'Tu sesión venció. Vuelve a iniciar sesión.',
  no_account: 'Este correo no tiene acceso a ninguna empresa. Pide una invitación.',
  not_a_member: 'No tienes acceso a esta empresa.',
  company_unavailable: 'Esta empresa está suspendida o todavía no está activa. Escríbenos a soporte si crees que es un error.',
  admin_required: 'Solo la administración de la empresa puede hacer esto.',
  platform_admin_required: 'Solo nuestro equipo puede entrar a la consola.',
  second_factor_required: 'Para entrar a la consola necesitas el segundo factor.',

  // Inbox
  conversation_not_found: 'Esta conversación ya no está disponible para ti.',
  contact_not_found: 'Este contacto ya no está disponible para ti.',
  assignee_cannot_attend: 'Esa persona no atiende este número. Elige a alguien de este número.',
  mention_not_member: 'Solo puedes mencionar a alguien de tu equipo.',
  service_window_closed: 'Pasaron más de 24 horas desde el último mensaje del cliente. Solo puedes enviarle una plantilla aprobada.',
  send_in_progress: 'Este mensaje ya se está enviando.',

  // Templates
  template_not_usable: 'Esa plantilla no se puede enviar: no está aprobada por Meta o es de otra cuenta de WhatsApp.',
  invalid_template: 'La plantilla no es válida: revisa los {{1}}, {{2}}… y que cada uno tenga su ejemplo.',
  template_exists: 'Ya existe una plantilla con ese nombre e idioma.',

  // Company data
  tag_not_found: 'Esa etiqueta ya no existe.',
  tag_name_taken: 'Ya existe una etiqueta con ese nombre.',
  unknown_tag: 'Una de las etiquetas ya no existe.',
  contact_exists: 'Ya hay un contacto con ese teléfono en ese número.',
  channel_not_attended: 'No atiendes ese número de WhatsApp. Elige uno de los tuyos.',
  quick_reply_not_found: 'Esa respuesta rápida ya no existe.',
  shortcut_taken: 'Ese atajo ya lo usa otra respuesta rápida.',
  stage_not_found: 'Esa etapa ya no existe.',
  stage_name_taken: 'Ya existe una etapa con ese nombre.',
  stage_in_use: 'Esa etapa todavía tiene contactos. Muévelos a otra antes de borrarla.',

  // Inventory
  inventory_item_not_found: 'Ese producto ya no existe.',
  sku_taken: 'Ese SKU ya lo usa otro producto de la empresa.',
  insufficient_stock: 'No hay suficientes unidades disponibles.',
  invalid_movement: 'La cantidad no corresponde al tipo de movimiento.',
  category_not_found: 'Esa categoría ya no existe.',
  category_name_taken: 'Ya existe una categoría con ese nombre.',
  category_in_use: 'Esa categoría todavía tiene productos. Cámbialos de categoría antes de borrarla.',
  variant_type_not_found: 'Ese tipo de variante ya no existe.',
  variant_option_not_found: 'Ese valor ya no existe o no es de este tipo.',
  variant_type_name_taken: 'Ya existe un tipo de variante con ese nombre.',
  variant_option_taken: 'Ese valor ya existe en este tipo.',
  variant_option_repeated: 'Ese valor ya lo usa otra variante del producto.',
  variant_type_in_use: 'Ese tipo lo usan productos. Cámbiales el tipo antes de borrarlo.',
  variant_option_in_use: 'Ese valor lo usan variantes. No se puede borrar mientras tanto.',
  variant_type_locked: 'El tipo de este producto no se puede cambiar: sus variantes ya usan sus valores.',
  invalid_variant: 'Cada variante debe tener su valor (o su nombre, si el producto no tiene tipo).',

  // Team and invitations
  member_not_found: 'Esa persona ya no está en el equipo.',
  channel_not_found: 'Ese número ya no está en la empresa.',
  unknown_channel: 'Uno de los números no es de esta empresa.',
  last_admin: 'La empresa no puede quedarse sin administración. Nombra a otra persona antes.',
  cannot_disable_self: 'No puedes desactivarte a ti mismo.',
  already_member: 'Esa persona ya está en el equipo.',
  invitation_exists: 'Ya hay una invitación abierta para ese correo. Puedes generar un enlace nuevo desde la lista.',
  invitation_not_found: 'Esta invitación no existe, ya se usó o fue anulada.',
  invitation_expired: 'Esta invitación venció. Pide a quien te invitó un enlace nuevo.',
  invitation_email_mismatch: 'Esta invitación es para otro correo. Entra con el correo al que te invitaron.',
  email_in_use: 'Ese correo ya tiene otra cuenta. Inicia sesión con ella para aceptar.',

  // Platform console
  tenant_not_found: 'Esa empresa ya no existe.',
  no_channel: 'La empresa necesita un número conectado antes de activarse.',
  waba_taken: 'Esa cuenta de WhatsApp ya pertenece a otra empresa de la plataforma.',
  phone_number_taken: 'Ese número ya está conectado a una empresa de la plataforma.',

  // Generic
  invalid_request: 'Hay datos que no son válidos. Revisa el formulario.',
  bad_request: 'La solicitud no es válida.',
  network: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
  internal: 'Algo falló de nuestro lado. Inténtalo de nuevo en un momento.',
  unexpected: 'Algo salió mal. Inténtalo de nuevo.',
};

/** Spanish sentence for an error code; unknown codes fall back by HTTP status. */
export function errorMessage(code: string, status: number): string {
  const known = MESSAGES[code];
  if (known) return known;
  if (status === 401) return MESSAGES['invalid_token']!;
  if (status === 403) return 'No tienes permiso para hacer esto.';
  if (status === 404) return 'Eso ya no está disponible.';
  if (status === 409 || status === 422) return 'No se pudo guardar: revisa los datos e inténtalo de nuevo.';
  if (status >= 500) return MESSAGES['internal']!;
  return MESSAGES['unexpected']!;
}
