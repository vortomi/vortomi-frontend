// «Uso y salud» of the console (mockup web-26): pure rules from the server's overview to what the
// screen shows. Same building blocks as the company's Reportes (periods, day bars, % change).
import type { Tone, UsageMonth } from '../../shared/api/models';
import { estimateSpend } from '../../shared/billing/meta-pricing';
import { formatCount, formatUsdCents } from '../../shared/format/money';
import { type DayBar, type DayRange, daysOf, percentChange } from '../reports/reports.rules';

/** /platform/usage/overview: what the server counts for a range of Caracas days. */
export interface UsageOverview {
  from: string;
  to: string;
  days: { date: string; tenantId: string; fromCustomers: number; automatic: number; staff: number; ownerApp: number }[];
  delivery: { tenantId: string; outbound: number; delivered: number; failed: number }[];
  agent: { tenantId: string; replies: number; inputTokens: number; outputTokens: number }[];
  health: {
    webhooks: { pending: number; retrying: number; last24h: number; lastAt: string | null };
    numbers: { connected: number; disconnected: number; restricted: number };
    failedLast24h: number;
    agentCompanies: number;
    companies: { active: number; numbers: number; people: number };
  };
}

type OverviewDay = UsageOverview['days'][number];

const sum = <T>(rows: readonly T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);
const answers = (d: OverviewDay) => d.automatic + d.staff + d.ownerApp;
const all = (d: OverviewDay) => d.fromCustomers + answers(d);
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

export interface UsageKpis {
  messages: number;
  /** Against the period before; null when it had nothing to compare with. */
  messagesChange: number | null;
  automaticPercent: number | null;
  automatic: number;
  answers: number;
  deliveredPercent: number | null;
  delivered: number;
  outbound: number;
  failed: number;
}

export function kpisOf(current: UsageOverview, previous: UsageOverview | null): UsageKpis {
  const messages = sum(current.days, all);
  const automatic = sum(current.days, (d) => d.automatic);
  const replies = sum(current.days, answers);
  const outbound = sum(current.delivery, (d) => d.outbound);
  const delivered = sum(current.delivery, (d) => d.delivered);
  return {
    messages,
    messagesChange: previous ? percentChange(messages, sum(previous.days, all)) : null,
    automaticPercent: percent(automatic, replies),
    automatic,
    answers: replies,
    // Rounded down: 99,8 % with two failures must never read «100 %».
    deliveredPercent: outbound > 0 ? Math.floor((delivered / outbound) * 100) : null,
    delivered,
    outbound,
    failed: sum(current.delivery, (d) => d.failed),
  };
}

/** One bar pair per day of the range: customers' messages (light) and answers (strong). */
export function barsOf(overview: UsageOverview, range: DayRange): DayBar[] {
  const byDay = new Map<string, { customers: number; answers: number }>();
  for (const d of overview.days) {
    const day = byDay.get(d.date) ?? { customers: 0, answers: 0 };
    day.customers += d.fromCustomers;
    day.answers += answers(d);
    byDay.set(d.date, day);
  }
  return daysOf(range).map((date) => ({ date, conversations: byDay.get(date)?.customers ?? 0, onTime: byDay.get(date)?.answers ?? 0 }));
}

export interface CompanyRow {
  id: string;
  name: string;
  messages: number;
  automaticPercent: number | null;
  agentReplies: number;
  freeUsed: number;
  free: number;
  estimate: string;
}

/** Every company with traffic in the range or Meta usage in the month, the busiest first. */
export function companyRows(overview: UsageOverview, usage: readonly UsageMonth[], names: ReadonlyMap<string, string>): CompanyRow[] {
  const ids = new Set([...overview.days.map((d) => d.tenantId), ...usage.map((u) => u.tenantId)]);
  return [...ids]
    .map((id) => {
      const days = overview.days.filter((d) => d.tenantId === id);
      const spend = estimateSpend(usage.filter((u) => u.tenantId === id));
      return {
        id,
        name: names.get(id) ?? 'Empresa',
        messages: sum(days, all),
        automaticPercent: percent(sum(days, (d) => d.automatic), sum(days, answers)),
        agentReplies: overview.agent.find((a) => a.tenantId === id)?.replies ?? 0,
        freeUsed: spend.service.sent,
        free: spend.service.free,
        estimate: formatUsdCents(spend.totalCents),
      };
    })
    .sort((a, b) => b.messages - a.messages || a.name.localeCompare(b.name));
}

export interface HealthItem {
  id: 'webhooks' | 'numbers' | 'delivery' | 'agent';
  title: string;
  hint: string;
  status: string;
  tone: Tone;
}

/** «hace 4 min», «hace 3 h», «hace 2 días». */
export function ago(iso: string | null, now: Date): string {
  if (!iso) return 'nunca';
  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

/** The platform right now: each line turns amber or red, and says why, when something needs us. */
export function healthItems(overview: UsageOverview, now: Date): HealthItem[] {
  const { webhooks, numbers, failedLast24h, agentCompanies } = overview.health;
  const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;
  const replies = sum(overview.agent, (a) => a.replies);
  const read = sum(overview.agent, (a) => a.inputTokens);
  const written = sum(overview.agent, (a) => a.outputTokens);
  return [
    {
      id: 'webhooks',
      title: 'Webhooks de Meta',
      hint: `${plural(webhooks.last24h, 'recibido', 'recibidos')} en 24 h · el último ${ago(webhooks.lastAt, now)} · ${plural(webhooks.pending, 'pendiente', 'pendientes')}`,
      ...(webhooks.retrying > 0
        ? { status: `${formatCount(webhooks.retrying)} reintentando`, tone: 'red' as const }
        : webhooks.pending > 20
          ? { status: 'Atrasados', tone: 'amber' as const }
          : { status: 'Al día', tone: 'green' as const }),
    },
    {
      id: 'numbers',
      title: 'Números de WhatsApp',
      hint: `${plural(numbers.connected, 'conectado', 'conectados')} · ${plural(numbers.disconnected, 'desconectado', 'desconectados')} · ${plural(numbers.restricted, 'restringido', 'restringidos')}`,
      ...(numbers.disconnected > 0
        ? { status: plural(numbers.disconnected, 'desconectado', 'desconectados'), tone: 'red' as const }
        : numbers.restricted > 0
          ? { status: plural(numbers.restricted, 'restringido', 'restringidos'), tone: 'amber' as const }
          : { status: 'Todos bien', tone: 'green' as const }),
    },
    {
      id: 'delivery',
      title: 'Entregas',
      hint: failedLast24h ? `${plural(failedLast24h, 'mensaje no se entregó', 'mensajes no se entregaron')} en las últimas 24 h` : '0 mensajes fallidos en las últimas 24 h',
      ...(failedLast24h > 0 ? { status: plural(failedLast24h, 'fallido', 'fallidos'), tone: 'amber' as const } : { status: 'Sin fallas', tone: 'green' as const }),
    },
    {
      id: 'agent',
      title: 'Agente IA',
      hint: agentCompanies
        ? `${plural(replies, 'respuesta', 'respuestas')} · ${formatCount(read)} tokens leídos y ${formatCount(written)} escritos · encendido en ${plural(agentCompanies, 'empresa', 'empresas')}`
        : 'Ninguna empresa lo tiene encendido',
      ...(agentCompanies ? { status: 'Activo', tone: 'green' as const } : { status: 'Apagado', tone: 'neutral' as const }),
    },
  ];
}
