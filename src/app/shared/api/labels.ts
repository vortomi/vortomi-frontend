// Visible text and colour for each stored value. Values stay English; labels are what people read.
import type {
  ChannelStatus,
  QualityRating,
  TemplateCategory,
  TemplateStatus,
  TenantPlan,
  TenantRole,
  TenantStatus,
  Tone,
  WhatsAppVertical,
} from './models';

export interface Label {
  text: string;
  tone: Tone;
}

export const TENANT_STATUS: Record<TenantStatus, Label> = {
  draft: { text: 'Borrador', tone: 'blue' },
  awaiting_channel: { text: 'Esperando canal', tone: 'amber' },
  active: { text: 'Activa', tone: 'green' },
  suspended: { text: 'Suspendida', tone: 'red' },
  cancelled: { text: 'Cancelada', tone: 'neutral' },
};

export const TENANT_PLAN: Record<TenantPlan, { text: string; detail: string }> = {
  internal: { text: 'Interno', detail: 'Uso propio, sin cobro' },
  basic: { text: 'Básico', detail: '1 número · 2 usuarios' },
  team: { text: 'Equipo', detail: '3 números · 5 usuarios' },
};

export const CHANNEL_STATUS: Record<ChannelStatus, Label> = {
  connected: { text: 'Conectado', tone: 'green' },
  disconnected: { text: 'Desconectado', tone: 'red' },
  restricted: { text: 'Restringido', tone: 'amber' },
};

export const QUALITY: Record<QualityRating, Label> = {
  high: { text: 'Alta', tone: 'green' },
  medium: { text: 'Media', tone: 'amber' },
  low: { text: 'Baja', tone: 'red' },
};

export const TEMPLATE_CATEGORY: Record<TemplateCategory, { text: string; detail: string }> = {
  utility: { text: 'Utilidad', detail: 'Avisos sobre algo que el cliente ya pidió: pedidos, citas, pagos.' },
  marketing: { text: 'Marketing', detail: 'Promociones y novedades. Es la más cara y la que más bloqueos genera.' },
  authentication: { text: 'Autenticación', detail: 'Códigos de un solo uso para verificar identidad.' },
};

export const TEMPLATE_STATUS: Record<TemplateStatus, Label> = {
  approved: { text: 'Aprobada', tone: 'green' },
  pending: { text: 'En revisión', tone: 'amber' },
  rejected: { text: 'Rechazada', tone: 'red' },
};

export const ROLE: Record<TenantRole, string> = {
  admin: 'Administración',
  agent: 'Agente',
};

export const INDUSTRIES = [
  'Repuestos',
  'Repostería',
  'Comida y delivery',
  'Salud',
  'Óptica',
  'Farmacia',
  'Mecánica',
  'Hogar',
  'Moda',
  'Servicios',
  'Otro',
];

export const TIMEZONES = [
  ['America/Caracas', 'Caracas (UTC−4)'],
  ['America/Bogota', 'Bogotá (UTC−5)'],
  ['America/Lima', 'Lima (UTC−5)'],
  ['America/Mexico_City', 'Ciudad de México (UTC−6)'],
  ['America/Santiago', 'Santiago (UTC−3)'],
] as const;

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

export const TONES: { id: Tone; text: string }[] = [
  { id: 'blue', text: 'Azul' },
  { id: 'teal', text: 'Verde azulado' },
  { id: 'green', text: 'Verde' },
  { id: 'amber', text: 'Ámbar' },
  { id: 'red', text: 'Rojo' },
  { id: 'violet', text: 'Violeta' },
  { id: 'pink', text: 'Rosado' },
  { id: 'neutral', text: 'Gris' },
];

export const STOCK_STATUS: Record<'available' | 'low' | 'out' | 'unavailable' | 'inactive', Label> = {
  available: { text: 'Disponible', tone: 'green' },
  low: { text: 'Quedan pocas', tone: 'amber' },
  out: { text: 'Agotado', tone: 'red' },
  unavailable: { text: 'No disponible hoy', tone: 'neutral' },
  inactive: { text: 'Inactivo', tone: 'neutral' },
};

/** Categories Meta accepts on the WhatsApp profile, as the customer sees them in Spanish. */
export const WHATSAPP_VERTICAL: Record<WhatsAppVertical, string> = {
  AUTO: 'Automotriz',
  APPAREL: 'Ropa y accesorios',
  BEAUTY: 'Belleza, spa y salón',
  EDU: 'Educación',
  ENTERTAIN: 'Entretenimiento',
  EVENT_PLAN: 'Organización de eventos',
  FINANCE: 'Finanzas y banca',
  GROCERY: 'Alimentos y víveres',
  GOVT: 'Gobierno',
  HOTEL: 'Hotel y hospedaje',
  HEALTH: 'Medicina y salud',
  NONPROFIT: 'Sin fines de lucro',
  PROF_SERVICES: 'Servicios profesionales',
  RETAIL: 'Tienda',
  TRAVEL: 'Viajes y transporte',
  RESTAURANT: 'Restaurante',
  ALCOHOL: 'Bebidas alcohólicas',
  OTHER: 'Otro',
};

/** Starting point for the WhatsApp category, from the industry typed in step 1. Can be changed. */
export const INDUSTRY_VERTICAL: Record<string, WhatsAppVertical> = {
  Repuestos: 'AUTO',
  Repostería: 'GROCERY',
  'Comida y delivery': 'RESTAURANT',
  Salud: 'HEALTH',
  Óptica: 'HEALTH',
  Farmacia: 'HEALTH',
  Mecánica: 'AUTO',
  Hogar: 'RETAIL',
  Moda: 'APPAREL',
  Servicios: 'PROF_SERVICES',
  Otro: 'OTHER',
};
