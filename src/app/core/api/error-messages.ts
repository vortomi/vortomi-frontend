// What the person reads for each error code the server sends (vortomi-backend,
// src/http/domain-errors.ts and the routes). Codes stay English; sentences are Spanish.

const MESSAGES: Record<string, string> = {
  // Session and access
  missing_token: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  invalid_token: 'Tu sesión venció. Vuelve a iniciar sesión.',
  unauthorized: 'Tu sesión venció. Vuelve a iniciar sesión.',
  no_account: 'Este correo no tiene acceso a ninguna empresa. Pide una invitación.',
  not_a_member: 'No tienes acceso a esta empresa.',
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
