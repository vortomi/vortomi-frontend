import type { CompanyPlan, CompanySubscription, Day, SubscriptionPayment } from './subscription.models';

/*
 * SAMPLE DATA. Companies are not linked to plans yet, so the company's own plan, period, payments
 * and usage are made up here (mockup web-35), built from today so the countdown always means
 * something. The panel says so on the screen; reminders outside Suscripción stay off while this is
 * what shows (SubscriptionData.remindersOn). Replace with the server's subscription when it exists.
 */

const DAY_MS = 86_400_000;
const addDays = (day: Day, days: number): Day => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** The same day `months` months away, kept inside short months. */
function addMonths(day: Day, months: number): Day {
  const [y, m, d] = [Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10))];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export function sampleSubscription(today: Day): CompanySubscription {
  const endsOn = addDays(today, 27);
  const startsOn = addMonths(endsOn, -3);
  const previous = addMonths(startsOn, -3);
  const first = addMonths(previous, -1);
  const payments: SubscriptionPayment[] = [
    { id: 'pay-3', paidOn: startsOn, planName: 'Equipo', months: 3, from: startsOn, to: endsOn, discountPercent: 5, amountCents: 22515, method: 'Pago móvil', reference: '004512', status: 'approved' },
    { id: 'pay-2', paidOn: previous, planName: 'Equipo', months: 3, from: previous, to: startsOn, discountPercent: 5, amountCents: 22515, method: 'Zelle', reference: '7Q2K', status: 'approved' },
    { id: 'pay-1', paidOn: first, planName: 'Básico', months: 1, from: first, to: previous, discountPercent: 0, amountCents: 3900, method: 'Pago móvil', reference: '003318', status: 'approved' },
  ];
  const nextMonth = addMonths(`${today.slice(0, 7)}-01`, 1);
  return {
    planName: 'Equipo',
    months: 3,
    discountPercent: 5,
    amountCents: 22515,
    monthlyBaseCents: 7900,
    startsOn,
    endsOn,
    benefits: [
      { label: 'Números de WhatsApp', used: 2, limit: 3 },
      { label: 'Usuarios', used: 4, limit: 5, hint: 'Te queda 1' },
      { label: 'Mensajes del mes', used: 2140, limit: 5000, hint: `Se reinicia el ${new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${nextMonth}T12:00:00Z`)).replace('.', '')}` },
      { label: 'Agente de ventas con IA', used: 0, limit: null },
      { label: 'Reportes del equipo', used: 0, limit: null },
      { label: 'Inventario y pedidos', used: 0, limit: null },
    ],
    payments,
    events: [
      { on: endsOn, kind: 'next_payment', title: 'Próximo pago', detail: 'Desde 79,00 $ al mes · elige 1, 3, 6 o 12 meses' },
      { on: addDays(today, 8), kind: 'price_change', title: 'El plan Equipo cambia de precio', detail: '79,00 $ → 89,00 $ al mes desde tu próxima factura. Lo que ya pagaste no cambia.' },
      { on: startsOn, kind: 'payment', title: 'Pagaste 3 meses', detail: '225,15 $ por Pago móvil · ahorraste 11,85 $' },
      { on: previous, kind: 'plan_change', title: 'Cambiaste a Equipo', detail: 'De Básico a Equipo' },
    ],
  };
}

/** The preview's plans ('mock' mode, never deployed), as the console would list them. */
export const PREVIEW_PLANS: CompanyPlan[] = [
  {
    id: 'plan-basic',
    name: 'Básico',
    description: 'Para negocios que empiezan con un solo número.',
    priceCents: 3900,
    discounts: { '1': 0, '3': 5, '6': 10, '12': 15 },
    benefits: ['1 número · 2 usuarios', 'Agente de ventas con IA', 'Inventario y pedidos'],
  },
  {
    id: 'plan-team',
    name: 'Equipo',
    description: 'Para equipos que atienden varios números.',
    priceCents: 7900,
    discounts: { '1': 0, '3': 5, '6': 10, '12': 20 },
    benefits: ['3 números · 5 usuarios', 'Agente de ventas con IA', 'Reportes del equipo'],
  },
  {
    id: 'plan-pro',
    name: 'Profesional',
    description: 'Para empresas con varias sucursales y mucho movimiento.',
    priceCents: 14900,
    discounts: { '1': 0, '3': 5, '6': 10, '12': 20 },
    benefits: ['5 números · 15 usuarios', 'Agente de ventas con IA', 'Soporte prioritario'],
  },
];
