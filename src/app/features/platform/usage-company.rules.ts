// One company's «Uso y salud» in the console (mockup web-27): pure rules from the server's answer
// to what the screen shows. Same pieces as «Uso y salud» and the company's Reportes.
import { CHANNEL_STATUS } from '../../shared/api/labels';
import type { OrderStatus, Tone } from '../../shared/api/models';
import { formatCount } from '../../shared/format/money';
import { type DayBar, type DayRange, daysOf, percentChange } from '../reports/reports.rules';

/** /platform/usage/companies/:tenantId: one company's counts for a range of Caracas days. */
export interface CompanyUsage {
  from: string;
  to: string;
  tenant: { id: string; name: string; plan: string; status: string; city: string; createdAt: string };
  days: { date: string; fromCustomers: number; automatic: number; staff: number; ownerApp: number }[];
  hours: { hour: number; fromCustomers: number; answers: number }[];
  replies: { customerMessages: number; unanswered: number; medianSec: number | null };
  delivery: { outbound: number; delivered: number; failed: number };
  staffPeople: number;
  agent: {
    settings: { enabled: boolean; schedule: string; humanPauseMinutes: number } | null;
    months: { month: string; replies: number; inputTokens: number; outputTokens: number }[];
  };
  numbers: { id: string; label: string; displayNumber: string; status: string; statusReason: string | null; coexistence: boolean; tokenExpiresAt: string | null }[];
  operation: {
    conversations: number;
    open: number;
    newConversations: number;
    orders: { status: string; count: number }[];
    people: { role: string; count: number }[];
    approvedTemplates: number;
  };
}

type Day = CompanyUsage['days'][number];
const sum = <T>(rows: readonly T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);
const answers = (d: Day) => d.automatic + d.staff + d.ownerApp;
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/** «21 s», «4 min», «2 h 10 min»: a waiting time as people say it. */
export function durationText(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

export function companyKpis(current: CompanyUsage, previous: CompanyUsage | null) {
  const messages = sum(current.days, (d) => d.fromCustomers + answers(d));
  const before = previous ? sum(previous.days, (d) => d.fromCustomers + answers(d)) : 0;
  return {
    messages,
    messagesChange: previous ? percentChange(messages, before) : null,
    medianSec: current.replies.medianSec,
    customerMessages: current.replies.customerMessages,
    unanswered: current.replies.unanswered,
    automatic: sum(current.days, (d) => d.automatic),
    answers: sum(current.days, answers),
    automaticPercent: percent(sum(current.days, (d) => d.automatic), sum(current.days, answers)),
  };
}

export function dayBars(usage: CompanyUsage, range: DayRange): DayBar[] {
  const byDay = new Map(usage.days.map((d) => [d.date, d]));
  return daysOf(range).map((date) => {
    const day = byDay.get(date);
    return { date, conversations: day?.fromCustomers ?? 0, onTime: day ? answers(day) : 0 };
  });
}

/** The 24 hours of the day, labelled every three. */
export function hourBars(usage: CompanyUsage): DayBar[] {
  const byHour = new Map(usage.hours.map((h) => [h.hour, h]));
  return Array.from({ length: 24 }, (_, hour) => ({
    date: `h${hour}`,
    conversations: byHour.get(hour)?.fromCustomers ?? 0,
    onTime: byHour.get(hour)?.answers ?? 0,
    label: hour % 3 === 0 ? `${hour} h` : '',
    title: `${String(hour).padStart(2, '0')}:00 a ${String(hour).padStart(2, '0')}:59`,
  }));
}

export interface ListRow {
  title: string;
  detail: string;
  value: string;
}

/** Who answered the customers: the automatic answers, the team in Vortomi, the owner on the phone. */
export function whoAnswers(usage: CompanyUsage): ListRow[] {
  const all = sum(usage.days, answers);
  const share = (n: number) => `${formatCount(n)} · ${percent(n, all) ?? 0} %`;
  const coexistence = usage.numbers.some((n) => n.coexistence);
  return [
    { title: 'Automáticas', detail: 'Agente IA y avisos fijos (comprobante recibido, fuera de horario)', value: share(sum(usage.days, (d) => d.automatic)) },
    {
      title: 'El equipo desde Vortomi',
      detail: usage.staffPeople ? `${formatCount(usage.staffPeople)} ${usage.staffPeople === 1 ? 'persona respondió' : 'personas respondieron'}` : 'Nadie del equipo respondió',
      value: share(sum(usage.days, (d) => d.staff)),
    },
    { title: 'El dueño desde el teléfono', detail: coexistence ? 'Con coexistencia: usa WhatsApp Business' : 'Número sin coexistencia', value: share(sum(usage.days, (d) => d.ownerApp)) },
  ];
}

const monthName = (month: string) => new Intl.DateTimeFormat('es-VE', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** The agent's month, the one before, and how the company set it up. */
export function agentRows(usage: CompanyUsage): ListRow[] {
  const months = usage.agent.months;
  const current = months.at(-1);
  const before = months.length > 1 ? months.at(-2) : undefined;
  const settings = usage.agent.settings;
  const rows: ListRow[] = [
    { title: 'Respuestas del período', detail: 'generadas por el modelo', value: formatCount(current?.replies ?? 0) },
    { title: 'Tokens leídos y escritos', detail: 'lo que consume el modelo', value: `${formatCount(current?.inputTokens ?? 0)} · ${formatCount(current?.outputTokens ?? 0)}` },
  ];
  if (before) rows.push({ title: capitalize(monthName(before.month)), detail: 'mes anterior', value: `${formatCount(before.replies)} respuestas` });
  if (settings) {
    const when = settings.schedule === 'after_hours' ? 'Fuera de horario' : 'Siempre';
    rows.push({ title: 'Cuándo responde · espera si alguien escribe', detail: 'configurado por la empresa', value: `${when} · ${settings.humanPauseMinutes} min` });
  }
  return rows;
}

export interface NumberRow {
  id: string;
  title: string;
  detail: string;
  status: string;
  tone: Tone;
}

export function numberRows(usage: CompanyUsage): NumberRow[] {
  return usage.numbers.map((n) => {
    const state = CHANNEL_STATUS[n.status as keyof typeof CHANNEL_STATUS] ?? { text: n.status, tone: 'neutral' as Tone };
    const access = n.tokenExpiresAt
      ? `el acceso vence el ${new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', timeZone: 'America/Caracas' }).format(new Date(n.tokenExpiresAt)).replace('.', '')}`
      : 'acceso sin fecha de vencimiento';
    return { id: n.id, title: `${n.label} · ${n.displayNumber}`, detail: `${n.coexistence ? 'Con coexistencia' : 'Sin coexistencia'} · ${access}`, status: state.text, tone: state.tone };
  });
}

/** An order state with its count, singular or plural («1 confirmado», «2 confirmados»). */
const ORDER_WORDS: Record<OrderStatus, [string, string]> = {
  awaiting_payment: ['esperando pago', 'esperando pago'],
  payment_review: ['pago por revisar', 'pagos por revisar'],
  confirmed: ['confirmado', 'confirmados'],
  done: ['completado', 'completados'],
  cancelled: ['cancelado', 'cancelados'],
};

/** Conversations, orders, people and templates: how the company works right now. */
export function operationRows(usage: CompanyUsage): ListRow[] {
  const { conversations, open, newConversations, orders, people, approvedTemplates } = usage.operation;
  const orderTotal = sum(orders, (o) => o.count);
  const peopleTotal = sum(people, (p) => p.count);
  return [
    { title: 'Conversaciones abiertas', detail: `${formatCount(conversations)} en total · ${formatCount(newConversations)} nuevas en el período`, value: formatCount(open) },
    {
      title: 'Pedidos',
      detail: orderTotal
        ? orders.map((o) => `${formatCount(o.count)} ${(ORDER_WORDS[o.status as OrderStatus] ?? [o.status, o.status])[o.count === 1 ? 0 : 1]}`).join(' · ')
        : 'Sin pedidos',
      value: formatCount(orderTotal),
    },
    {
      title: 'Personas con acceso',
      detail: peopleTotal ? people.map((p) => `${formatCount(p.count)} ${p.role === 'admin' ? (p.count === 1 ? 'administrador' : 'administradores') : p.count === 1 ? 'agente' : 'agentes'}`).join(' · ') : 'Nadie todavía',
      value: formatCount(peopleTotal),
    },
    { title: 'Plantillas aprobadas por Meta', detail: 'para escribir fuera de la ventana de 24 h', value: formatCount(approvedTemplates) },
  ];
}
