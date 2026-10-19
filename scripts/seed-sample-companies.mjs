// Adds full sample data for Mueblería Valle (sells, with pipeline and inventory) and
// Clínica Dental Sonrisa (customer service only) to the shared table files.
// Idempotent: rows of these two companies are replaced, nothing else is touched.
// Usage: node scripts/seed-sample-companies.mjs
// Same layout as the future database: shared tables, every row tagged with its tenantId.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../public/data/', import.meta.url));
const SEEDED = new Set(['ten_valle', 'ten_sonrisa']);
const at = (day, time) => `2026-10-${day}T${time}:00-04:00`;
// Same notation as the rest of the sample data: Caracas time, -04:00.
const plus24h = (iso) => new Date(new Date(iso).getTime() + 86_400_000 - 4 * 3_600_000).toISOString().slice(0, 19) + '-04:00';

// ---------- Mueblería Valle ----------
const valle = {
  tags: [
    { id: 'tag_v_custom', name: 'A medida', tone: 'violet' },
    { id: 'tag_v_caracas', name: 'Caracas', tone: 'blue' },
    { id: 'tag_v_interior', name: 'Interior', tone: 'teal' },
    { id: 'tag_v_deposit', name: 'Abonó', tone: 'green' },
    { id: 'tag_v_claim', name: 'Reclamo', tone: 'red' },
  ],
  stages: [
    { id: 'stg_v_inquiry', name: 'Consulta', color: '#8a93a3', position: 1 },
    { id: 'stg_v_quoted', name: 'Cotizado', color: '#e8743b', position: 2 },
    { id: 'stg_v_deposit', name: 'Abono recibido', color: '#7c3aed', position: 3 },
    { id: 'stg_v_production', name: 'En fabricación', color: '#3b4fd8', position: 4 },
    { id: 'stg_v_delivered', name: 'Entregado', color: '#10a37f', position: 5 },
  ],
  quickReplies: [
    { id: 'qr_v_deposit', shortcut: 'abono', title: 'Abono para apartar', body: 'Para apartar tu pedido pedimos el 50 % de abono por Pago Móvil, Zelle o en tienda. El resto se paga al recibir.' },
    { id: 'qr_v_delivery', shortcut: 'despacho', title: 'Despachos', body: 'En Caracas el despacho es gratis. Al interior enviamos por encomienda y el flete lo paga quien recibe.' },
    { id: 'qr_v_measures', shortcut: 'medidas', title: 'Toma de medidas', body: 'Para muebles a medida vamos a tu casa a tomar las medidas sin costo, de lunes a viernes.' },
    { id: 'qr_v_warranty', shortcut: 'garantia', title: 'Garantía', body: 'Todos nuestros muebles tienen 1 año de garantía de fabricación.' },
  ],
  templates: [
    { id: 'tpl_v_delivery', name: 'delivery_scheduled', category: 'utility', status: 'approved', rejectionReason: null, body: 'Hola {{1}}, tu pedido sale el {{2}} en la mañana. Te escribimos cuando el camión esté cerca.' },
    { id: 'tpl_v_balance', name: 'balance_reminder', category: 'utility', status: 'approved', rejectionReason: null, body: 'Hola {{1}}, te recordamos que el saldo de tu pedido {{2}} se paga al recibirlo.' },
    { id: 'tpl_v_sale', name: 'october_mattress_sale', category: 'marketing', status: 'approved', rejectionReason: null, body: 'Hola {{1}}, este mes los colchones tienen 20 % de descuento en tienda. Responde SÍ y te enviamos los modelos.' },
    { id: 'tpl_v_measures', name: 'measurements_visit', category: 'utility', status: 'pending', rejectionReason: null, body: 'Hola {{1}}, el {{2}} vamos a tomar las medidas en tu casa. Responde para confirmar la hora.' },
  ],
  settings: {
    id: 'set_valle',
    logoDataUrl: null,
    businessHours: [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, open: day === 0 ? null : '09:00', close: day === 0 ? null : day === 6 ? '14:00' : '18:00' })),
    awayMessage: '¡Hola! Ya cerró la tienda. Mañana desde las 9 am te atendemos.',
    exchangeRateVes: 186.2,
  },
  contacts: [
    { id: 'con_v_adriana', channel: 'ch_valle_store', waId: '584145550311', name: 'Adriana Salazar', stageId: 'stg_v_quoted', tagIds: ['tag_v_custom', 'tag_v_caracas'], owner: 'usr_andres', purchases: [0, 0], quote: 68000, attrs: [['address', 'Dirección', 'Los Palos Grandes'], ['request', 'Pedido', 'Comedor de 6 puestos']], created: at('09', '09:40') },
    { id: 'con_v_gustavo', channel: 'ch_valle_store', waId: '584245550322', name: 'Gustavo Peña', stageId: 'stg_v_inquiry', tagIds: [], owner: null, purchases: [0, 0], quote: null, attrs: [], created: at('09', '10:20') },
    { id: 'con_v_milagros', channel: 'ch_valle_store', waId: '584125550333', name: 'Milagros Rivero', stageId: 'stg_v_deposit', tagIds: ['tag_v_deposit', 'tag_v_interior'], owner: 'usr_sofia', purchases: [1, 16500], quote: 42000, attrs: [['city', 'Ciudad', 'Valencia']], created: at('02', '11:00') },
    { id: 'con_v_hotel', channel: 'ch_valle_store', waId: '582125550344', name: 'Hotel Ávila Suites', stageId: 'stg_v_production', tagIds: ['tag_v_custom'], owner: 'usr_elena', purchases: [2, 512000], quote: 360000, attrs: [['customer_type', 'Tipo', 'Empresa'], ['request', 'Pedido', '20 sillas Milano para el restaurante']], created: '2026-09-15T10:00:00-04:00' },
    { id: 'con_v_ricardo', channel: 'ch_valle_delivery', waId: '584145550355', name: 'Ricardo Blanco', stageId: 'stg_v_delivered', tagIds: ['tag_v_caracas'], owner: 'usr_ramon', purchases: [1, 29000], quote: 29000, attrs: [['address', 'Dirección', 'El Cafetal']], created: '2026-09-28T15:00:00-04:00' },
    { id: 'con_v_yusmary', channel: 'ch_valle_delivery', waId: '584165550366', name: 'Yusmary Torres', stageId: 'stg_v_delivered', tagIds: ['tag_v_claim', 'tag_v_caracas'], owner: 'usr_valeria', purchases: [1, 18000], quote: 18000, attrs: [['address', 'Dirección', 'Montalbán']], created: '2026-09-30T12:00:00-04:00' },
    { id: 'con_v_oscar', channel: 'ch_valle_store', waId: '584245550377', name: 'Óscar Medina', stageId: 'stg_v_inquiry', tagIds: [], owner: null, purchases: [0, 0], quote: null, attrs: [], created: at('06', '19:10') },
  ],
  // [contactId, assignedUserId, status, messages]; message: [direction, time, body, author?, type?, templateId?]
  conversations: [
    ['con_v_adriana', 'usr_andres', 'open', [
      ['in', at('09', '09:40'), 'Buenos días, ¿hacen comedores a medida? Necesito uno de 6 puestos para un espacio de 1,80 m.'],
      ['out', at('09', '09:52'), 'Buenos días Adriana, sí. El comedor de 6 puestos a medida sale en 680 $ y tarda unas 3 semanas.', 'usr_andres'],
      ['in', at('09', '10:05'), '¿Y la madera es maciza? ¿Puedo ir a verlo?'],
      ['out', at('09', '10:12'), 'Sí, es pino macizo tratado. Te esperamos en la tienda de 9 am a 6 pm, tenemos uno de muestra.', 'usr_andres'],
    ]],
    ['con_v_gustavo', null, 'open', [
      ['in', at('09', '10:20'), 'Hola, ¿tienen sofás cama? ¿Qué precio?'],
    ]],
    ['con_v_milagros', 'usr_sofia', 'open', [
      ['out', at('08', '17:30'), 'Milagros, para apartar el colchón y la base te pedimos el 50 %: 210 $.', 'usr_sofia'],
      ['in', at('09', '09:55'), 'Listo, ya hice el abono por Zelle. Te paso el comprobante ahorita.'],
    ]],
    ['con_v_hotel', 'usr_elena', 'open', [
      ['in', at('08', '15:30'), 'Buenas tardes, ¿cómo va la fabricación de las 20 sillas?'],
      ['out', at('08', '16:05'), 'Buenas tardes. Ya están armadas, falta el barniz. Las entregamos el martes 20.', 'usr_elena'],
      ['in', at('08', '16:20'), 'Perfecto, gracias.'],
    ]],
    ['con_v_ricardo', 'usr_ramon', 'resolved', [
      ['out', at('08', '08:10'), 'Hola Ricardo, tu pedido sale hoy en la mañana. Te escribimos cuando el camión esté cerca.', 'usr_ramon', 'template', 'tpl_v_delivery'],
      ['in', at('08', '12:40'), 'Llegó perfecto el sofá, muchas gracias.'],
      ['out', at('08', '12:45'), '¡Qué bueno! Cualquier cosa nos escribes.', 'usr_ramon'],
    ]],
    ['con_v_yusmary', 'usr_valeria', 'open', [
      ['in', at('09', '08:05'), 'Buenos días. La silla que me llegó ayer tiene una raya en el espaldar.'],
      ['in', at('09', '08:06'), '¿La pueden cambiar?'],
    ]],
    ['con_v_oscar', null, 'open', [
      ['in', at('06', '19:10'), 'Buenas noches, ¿hacen closets a medida? ¿Cuánto cuesta el metro?'],
    ]],
  ],
  notes: [
    { id: 'note_v_hotel', conversation: 'con_v_hotel', author: 'usr_elena', mention: 'usr_ramon', body: 'Ramón, aparta el camión grande para el martes 20 en la mañana.', created: at('08', '16:10') },
    { id: 'note_v_yusmary', conversation: 'con_v_yusmary', author: 'usr_valeria', mention: 'usr_elena', body: 'Elena, ¿le cambiamos la silla o mandamos al tapicero? Es su primera compra.', created: at('09', '08:30') },
  ],
  products: [
    { id: 'prd_v_chair', name: 'Silla Milano', category: 'Comedor', description: 'Silla de pino macizo con asiento tapizado.', stockMode: 'units', active: true, created: '2026-09-10T10:00:00-04:00', variants: [
      { id: 'var_v_chair_natural', name: 'Madera natural', sku: 'VAL-SIL-MIL-NAT', priceCents: 4500, onHand: 24, reserved: 4, low: 6, initial: 30, sold: 6 },
      { id: 'var_v_chair_wenge', name: 'Wengué', sku: 'VAL-SIL-MIL-WEN', priceCents: 4500, onHand: 3, reserved: 0, low: 6, initial: 12, sold: 9 },
    ] },
    { id: 'prd_v_mattress', name: 'Colchón ortopédico', category: 'Dormitorio', description: 'Resortes ensacados, 25 cm de alto.', stockMode: 'units', active: true, created: '2026-09-10T10:00:00-04:00', variants: [
      { id: 'var_v_mattress_single', name: 'Individual', sku: 'VAL-COL-IND', priceCents: 12000, onHand: 8, reserved: 0, low: 2, initial: 10, sold: 2 },
      { id: 'var_v_mattress_double', name: 'Matrimonial', sku: 'VAL-COL-MAT', priceCents: 16500, onHand: 5, reserved: 1, low: 2, initial: 8, sold: 3 },
      { id: 'var_v_mattress_queen', name: 'Queen', sku: 'VAL-COL-QUE', priceCents: 21000, onHand: 0, reserved: 0, low: 1, initial: 4, sold: 4 },
    ] },
    { id: 'prd_v_sofa', name: 'Sofá cama Lisboa', category: 'Sala', description: 'Tela antimanchas, se abre en cama matrimonial.', stockMode: 'units', active: true, created: '2026-09-10T10:00:00-04:00', variants: [
      { id: 'var_v_sofa_grey', name: 'Gris', sku: 'VAL-SOF-LIS-GRI', priceCents: 38000, onHand: 2, reserved: 1, low: 1, initial: 4, sold: 2 },
    ] },
    { id: 'prd_v_dining', name: 'Comedor a medida', category: 'Comedor', description: 'Pino macizo. Se fabrica en unas 3 semanas.', stockMode: 'availability', active: true, created: '2026-09-10T10:00:00-04:00', variants: [
      { id: 'var_v_dining_6', name: '6 puestos', sku: 'VAL-COM-MED-6', priceCents: 68000, available: true },
      { id: 'var_v_dining_8', name: '8 puestos', sku: 'VAL-COM-MED-8', priceCents: 89000, available: true },
    ] },
    { id: 'prd_v_closet', name: 'Closet a medida', category: 'Dormitorio', description: 'Precio por metro lineal, con toma de medidas incluida.', stockMode: 'availability', active: true, created: '2026-09-10T10:00:00-04:00', variants: [
      { id: 'var_v_closet_meter', name: 'Metro lineal', sku: 'VAL-CLO-MED-ML', priceCents: 15000, available: false },
    ] },
  ],
};

// ---------- Clínica Dental Sonrisa (customer service only: no pipeline, no inventory) ----------
const sonrisa = {
  tags: [
    { id: 'tag_s_ortho', name: 'Ortodoncia', tone: 'violet' },
    { id: 'tag_s_cleaning', name: 'Limpieza', tone: 'teal' },
    { id: 'tag_s_urgent', name: 'Urgencia', tone: 'red' },
    { id: 'tag_s_insurance', name: 'Seguro', tone: 'blue' },
    { id: 'tag_s_kids', name: 'Niños', tone: 'pink' },
  ],
  stages: [],
  quickReplies: [
    { id: 'qr_s_address', shortcut: 'direccion', title: 'Dirección', body: 'Estamos en la Av. Bolívar Norte, Torre Banaven, piso 2, en Valencia. Hay estacionamiento.' },
    { id: 'qr_s_hours', shortcut: 'horario', title: 'Horario', body: 'Atendemos de lunes a viernes de 8 am a 5 pm y los sábados de 8 am a 12 m.' },
    { id: 'qr_s_insurance', shortcut: 'seguros', title: 'Seguros', body: 'Trabajamos con Seguros Caracas, Mercantil y La Previsora. Trae tu carnet y la cédula.' },
    { id: 'qr_s_cleaning', shortcut: 'limpieza', title: 'Limpieza', body: 'La limpieza cuesta 35 $ e incluye revisión. Dura unos 40 minutos.' },
  ],
  templates: [
    { id: 'tpl_s_reminder', name: 'appointment_reminder', category: 'utility', status: 'approved', rejectionReason: null, body: 'Hola {{1}}, te recordamos tu cita del {{2}} en Clínica Dental Sonrisa. Responde SÍ para confirmar.' },
    { id: 'tpl_s_moved', name: 'appointment_moved', category: 'utility', status: 'approved', rejectionReason: null, body: 'Hola {{1}}, tu cita quedó para el {{2}}. Si no te queda bien, respóndenos por aquí.' },
    { id: 'tpl_s_checkup', name: 'six_month_checkup', category: 'marketing', status: 'rejected', rejectionReason: 'Meta la clasificó como marketing pero se envió como utilidad. Vuelve a enviarla como marketing.', body: 'Hola {{1}}, ya pasaron 6 meses de tu última limpieza. Agenda tu revisión con 10 % de descuento.' },
  ],
  settings: {
    id: 'set_sonrisa',
    // A clinic that only answers: no pipeline, no inventory.
    workMode: 'support_only',
    logoDataUrl: null,
    businessHours: [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, open: day === 0 ? null : '08:00', close: day === 0 ? null : day === 6 ? '12:00' : '17:00' })),
    awayMessage: 'Hola, la clínica está cerrada. Si es una urgencia llama al 0241-555-0120. Mañana te respondemos.',
    exchangeRateVes: 185.9,
  },
  contacts: [
    { id: 'con_s_patricia', channel: 'ch_sonrisa_main', waId: '584145550411', name: 'Patricia Lugo', stageId: null, tagIds: ['tag_s_ortho'], owner: 'usr_hector', purchases: [8, 96000], quote: null, attrs: [['next_appointment', 'Próxima cita', 'Jueves 15 de octubre, 3:00 pm'], ['treatment', 'Tratamiento', 'Brackets, control mensual']], created: '2026-03-02T10:00:00-04:00' },
    { id: 'con_s_jorge', channel: 'ch_sonrisa_main', waId: '584245550422', name: 'Jorge Andrade', stageId: null, tagIds: ['tag_s_urgent'], owner: 'usr_paola', purchases: [0, 0], quote: null, attrs: [['treatment', 'Tratamiento', 'Dolor de muela, evaluar endodoncia']], created: at('08', '16:10') },
    { id: 'con_s_camila', channel: 'ch_sonrisa_main', waId: '584125550433', name: 'Camila Reyes', stageId: null, tagIds: ['tag_s_kids', 'tag_s_cleaning'], owner: 'usr_miguel', purchases: [2, 7000], quote: null, attrs: [['patient', 'Paciente', 'Sebastián, 7 años (hijo)']], created: '2026-05-20T09:00:00-04:00' },
    { id: 'con_s_ernesto', channel: 'ch_sonrisa_main', waId: '584165550444', name: 'Ernesto Guzmán', stageId: null, tagIds: ['tag_s_insurance'], owner: null, purchases: [0, 0], quote: null, attrs: [['insurance', 'Seguro', 'Seguros Caracas']], created: at('08', '17:55') },
    { id: 'con_s_lorena', channel: 'ch_sonrisa_main', waId: '584145550455', name: 'Lorena Díaz', stageId: null, tagIds: ['tag_s_cleaning'], owner: 'usr_hector', purchases: [3, 10500], quote: null, attrs: [['next_appointment', 'Próxima cita', 'Abril 2027, limpieza']], created: '2025-11-12T09:00:00-04:00' },
    { id: 'con_s_alberto', channel: 'ch_sonrisa_main', waId: '584245550466', name: 'Alberto Mena', stageId: null, tagIds: [], owner: null, purchases: [0, 0], quote: null, attrs: [], created: at('05', '11:30') },
  ],
  conversations: [
    ['con_s_patricia', 'usr_hector', 'open', [
      ['out', at('08', '09:00'), 'Hola Patricia, te recordamos tu cita del jueves 15 a las 3:00 pm en Clínica Dental Sonrisa. Responde SÍ para confirmar.', 'usr_hector', 'template', 'tpl_s_reminder'],
      ['in', at('08', '17:40'), '¿Puedo pasar la cita del jueves para el viernes en la mañana?'],
    ]],
    ['con_s_jorge', 'usr_paola', 'open', [
      ['in', at('08', '16:10'), 'Buenas tardes, me duele muchísimo una muela. ¿Me pueden ver hoy?'],
      ['out', at('08', '16:15'), 'Hola Jorge, sí. Te esperamos hoy a las 6:00 pm con la Dra. Torres. Trae tu cédula.', 'usr_paola'],
      ['in', at('08', '16:20'), 'Gracias, allá estaré.'],
    ]],
    ['con_s_camila', 'usr_miguel', 'open', [
      ['in', at('08', '15:00'), 'Hola, quiero agendar una limpieza para mi hijo Sebastián. ¿Atienden niños de 7 años?'],
    ]],
    ['con_s_ernesto', null, 'open', [
      ['in', at('08', '17:55'), 'Buenas, ¿aceptan Seguros Caracas para ortodoncia?'],
    ]],
    ['con_s_lorena', 'usr_hector', 'resolved', [
      ['in', at('07', '10:00'), '¿Qué día me toca la próxima limpieza?'],
      ['out', at('07', '10:12'), 'Hola Lorena, te toca en abril. Te escribimos unos días antes para agendarla.', 'usr_hector'],
      ['in', at('07', '10:15'), 'Perfecto, gracias.'],
    ]],
    ['con_s_alberto', null, 'open', [
      ['in', at('05', '11:30'), 'Hola, ¿cuánto cuesta un blanqueamiento?'],
    ]],
  ],
  notes: [
    { id: 'note_s_patricia', conversation: 'con_s_patricia', author: 'usr_gabriela', mention: 'usr_hector', body: 'El viernes en la mañana la agenda del Dr. Salas está llena. Ofrécele las 2:00 pm.', created: at('08', '17:50') },
  ],
  products: [],
};

// ---------- builders ----------
function build(tenantId, seed) {
  const out = { tags: [], stages: [], quickReplies: [], templates: [], settings: [], contacts: [], conversations: [], messages: [], notes: [], products: [], variants: [], movements: [] };
  out.tags = seed.tags.map((t) => ({ id: t.id, tenantId, name: t.name, tone: t.tone }));
  out.stages = seed.stages.map((s) => ({ id: s.id, tenantId, name: s.name, color: s.color, position: s.position }));
  out.quickReplies = seed.quickReplies.map((q) => ({ id: q.id, tenantId, shortcut: q.shortcut, title: q.title, body: q.body }));
  out.templates = seed.templates.map((t) => ({ id: t.id, tenantId, name: t.name, category: t.category, language: 'es', status: t.status, rejectionReason: t.rejectionReason, body: t.body }));
  const { id: settingsId, ...settings } = seed.settings;
  out.settings = [{ id: settingsId, tenantId, ...settings }];
  const contactById = new Map(seed.contacts.map((c) => [c.id, c]));
  out.contacts = seed.contacts.map((c) => ({
    id: c.id, tenantId, channelAccountId: c.channel, waId: c.waId, name: c.name,
    phone: `+${c.waId.slice(0, 2)} ${c.waId.slice(2, 5)}-${c.waId.slice(5, 8)}-${c.waId.slice(8)}`,
    stageId: c.stageId, tagIds: c.tagIds, ownerUserId: c.owner, purchasesCount: c.purchases[0], purchasesTotalCents: c.purchases[1],
    attributes: c.attrs.map(([key, label, value]) => ({ key, label, value })), quoteCents: c.quote, createdAt: c.created,
  }));
  for (const [contactId, assigned, status, messages] of seed.conversations) {
    const contact = contactById.get(contactId);
    const conversationId = contactId.replace('con_', 'cnv_');
    const rows = messages.map(([dir, createdAt, body, author = null, type = 'text', templateId = null], i) => ({
      id: `${conversationId.replace('cnv_', 'msg_')}_${i + 1}`, tenantId, conversationId,
      direction: dir === 'in' ? 'inbound' : 'outbound', type, body, authorUserId: dir === 'in' ? null : author,
      templateId, status: dir === 'in' ? null : 'read', createdAt,
    }));
    const last = rows.at(-1);
    const lastInbound = rows.filter((m) => m.direction === 'inbound').at(-1);
    // Unread = customer messages after the last reply, only while the chat is open.
    const lastOutIndex = rows.map((m) => m.direction).lastIndexOf('outbound');
    out.messages.push(...rows);
    out.conversations.push({
      id: conversationId, tenantId, channelAccountId: contact.channel, contactId, assignedUserId: assigned, status,
      lastMessageAt: last.createdAt,
      lastMessagePreview: last.type === 'template' ? `Plantilla: ${last.body}` : last.body,
      unreadCount: status === 'open' ? rows.slice(lastOutIndex + 1).filter((m) => m.direction === 'inbound').length : 0,
      serviceWindowExpiresAt: lastInbound ? plus24h(lastInbound.createdAt) : null,
    });
  }
  out.notes = seed.notes.map((n) => ({ id: n.id, tenantId, conversationId: n.conversation.replace('con_', 'cnv_'), authorUserId: n.author, mentionUserId: n.mention, body: n.body, createdAt: n.created }));
  let movement = 0;
  for (const p of seed.products) {
    out.products.push({ id: p.id, tenantId, name: p.name, category: p.category, description: p.description, photoDataUrl: null, stockMode: p.stockMode, active: p.active, createdAt: p.created });
    for (const v of p.variants) {
      const units = p.stockMode === 'units';
      out.variants.push({ id: v.id, tenantId, productId: p.id, name: v.name, sku: v.sku, priceCents: v.priceCents, onHand: units ? v.onHand : 0, reserved: units ? v.reserved : 0, available: v.available ?? true, lowStockThreshold: units ? v.low : 0 });
      if (!units) continue;
      // History must add up to on_hand: stock only changes through movements.
      if (v.initial - v.sold !== v.onHand) throw new Error(`Movements of ${v.sku} do not add up`);
      out.movements.push({ id: `mov_v_${++movement}`, tenantId, variantId: v.id, kind: 'initial', quantity: v.initial, reason: 'Carga inicial', userId: 'usr_elena', createdAt: p.created });
      if (v.sold) out.movements.push({ id: `mov_v_${++movement}`, tenantId, variantId: v.id, kind: 'sale', quantity: -v.sold, reason: 'Ventas de septiembre y octubre', userId: 'usr_sofia', createdAt: '2026-10-05T17:00:00-04:00' });
    }
  }
  return out;
}

const built = [build('ten_valle', valle), build('ten_sonrisa', sonrisa)];
const merge = (key) => built.flatMap((b) => b[key]);

const TABLES = {
  tags: merge('tags'),
  'pipeline-stages': merge('stages'),
  'quick-replies': merge('quickReplies'),
  templates: merge('templates'),
  'tenant-settings': merge('settings'),
  contacts: merge('contacts'),
  conversations: merge('conversations'),
  messages: merge('messages'),
  notes: merge('notes'),
  products: merge('products'),
  'product-variants': merge('variants'),
  'stock-movements': merge('movements'),
};

// One row per line, spaced like the hand-written files: { "id": "x", "list": ["a", "b"] }
const fmt = (v) =>
  Array.isArray(v)
    ? `[${v.map(fmt).join(', ')}]`
    : v && typeof v === 'object'
      ? Object.keys(v).length
        ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${fmt(x)}`).join(', ')} }`
        : '{}'
      : JSON.stringify(v);
const write = (table, rows) => writeFileSync(`${DIR}${table}.json`, `[\n${rows.map((r) => '  ' + fmt(r)).join(',\n')}\n]\n`);
const read = (table) => JSON.parse(readFileSync(`${DIR}${table}.json`, 'utf8'));

for (const [table, rows] of Object.entries(TABLES)) {
  const kept = read(table).filter((row) => !SEEDED.has(row.tenantId));
  const ids = new Set(kept.map((r) => r.id));
  for (const row of rows) if (ids.has(row.id)) throw new Error(`Duplicate id ${row.id} in ${table}`);
  write(table, [...kept, ...rows]);
  console.log(`${table}: +${rows.length}`);
}

// Valeria works for both companies: agent at the furniture store, admin of the clinic's WhatsApp.
const users = read('users').map((u) => (u.id === 'usr_valeria' ? { ...u, email: 'valeria.gil@gmail.com' } : u));
write('users', users);
const memberships = read('memberships').filter((m) => !(m.tenantId === 'ten_sonrisa' && m.userId === 'usr_valeria'));
const lastSonrisa = memberships.map((m) => m.tenantId).lastIndexOf('ten_sonrisa');
memberships.splice(lastSonrisa + 1, 0, { tenantId: 'ten_sonrisa', userId: 'usr_valeria', role: 'admin', status: 'active', channelAccountIds: ['ch_sonrisa_main'], canSeeOthers: true });
write('memberships', memberships);
console.log('users + memberships: Valeria in both companies');
