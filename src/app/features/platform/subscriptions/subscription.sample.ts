import type { Day, PaymentMethod, PlanTerms, Subscription, SubscriptionPayment } from './subscription.models';
import { addDays, monthOf, shiftMonths } from './subscription.rules';

/*
 * SAMPLE DATA. The billing model is not decided yet (doc. 06, question 2), so this tab shows made-up
 * companies, prices and payments, written here and never sent to the server. Dates are built from
 * today so the statuses (due soon, overdue, trial) keep their meaning whenever the page is opened.
 * Replace this file with a remote source once billing exists.
 */

export const SAMPLE_PLANS: PlanTerms[] = [
  {
    plan: 'basic',
    priceCents: 3900,
    users: 2,
    numbers: 1,
    features: [
      { text: 'Agente de ventas con IA', included: true },
      { text: 'Inventario y pedidos', included: true },
      { text: 'Reportes del equipo', included: false },
    ],
  },
  {
    plan: 'team',
    priceCents: 7900,
    users: 5,
    numbers: 3,
    features: [
      { text: 'Agente de ventas con IA', included: true },
      { text: 'Inventario y pedidos', included: true },
      { text: 'Reportes del equipo', included: true },
    ],
  },
  { plan: 'internal', priceCents: 0, users: null, numbers: null, features: [{ text: 'Solo para Vortex', included: true }] },
];

/** One payment per method, newest first, for the months before the one due on `nextChargeOn`. */
function history(id: string, nextChargeOn: Day, billingDay: number, cents: number, methods: PaymentMethod[]): SubscriptionPayment[] {
  const payments: SubscriptionPayment[] = [];
  methods.forEach((method, i) => {
    const due = shiftMonths(nextChargeOn, billingDay, -(i + 1));
    payments.push({
      id: `${id}-p${i}`,
      month: monthOf(due),
      amountCents: cents,
      method,
      reference: method === 'cash' ? '' : String(3318 + i * 1477).padStart(6, '0'),
      paidOn: addDays(due, -1 + (i % 3)),
      receiptName: null,
    });
  });
  return payments;
}

interface Seed {
  id: string;
  name: string;
  line: string;
  plan: Subscription['plan'];
  /** Days from today to the next charge. */
  dueIn: number;
  months: PaymentMethod[];
  users: number;
  numbers: number;
  trialFor?: number;
}

const SEEDS: Seed[] = [
  { id: 'sub_ra', name: 'Repuestos Andinos', line: 'Repuestos · Caracas', plan: 'team', dueIn: 12, months: ['mobile_payment', 'mobile_payment', 'zelle'], users: 3, numbers: 2 },
  { id: 'sub_sonrisa', name: 'Clínica Dental Sonrisa', line: 'Salud · Valencia', plan: 'team', dueIn: 3, months: ['transfer', 'transfer'], users: 4, numbers: 1 },
  { id: 'sub_vision', name: 'Óptica Visión', line: 'Óptica · Maracay', plan: 'basic', dueIn: -9, months: ['mobile_payment', 'zelle'], users: 2, numbers: 1 },
  { id: 'sub_ortiz', name: 'Taller Ortiz', line: 'Mecánica · Barquisimeto', plan: 'basic', dueIn: 6, months: [], users: 1, numbers: 1, trialFor: 6 },
  { id: 'sub_valle', name: 'Mueblería Valle', line: 'Hogar · Caracas', plan: 'team', dueIn: 16, months: ['zelle', 'zelle', 'zelle', 'cash'], users: 5, numbers: 2 },
  { id: 'sub_popular', name: 'Farmacia Popular', line: 'Farmacia · Puerto La Cruz', plan: 'basic', dueIn: 25, months: ['cash', 'mobile_payment'], users: 2, numbers: 1 },
  { id: 'sub_us', name: 'Nosotros', line: 'Uso propio', plan: 'internal', dueIn: 0, months: [], users: 3, numbers: 1 },
];

export function sampleSubscriptions(today: Day): Subscription[] {
  return SEEDS.map((seed) => {
    const nextChargeOn = addDays(today, seed.dueIn);
    const billingDay = Number(nextChargeOn.slice(8, 10));
    const cents = SAMPLE_PLANS.find((p) => p.plan === seed.plan)!.priceCents;
    const payments = history(seed.id, nextChargeOn, billingDay, cents, seed.months);
    return {
      id: seed.id,
      companyName: seed.name,
      companyLine: seed.line,
      plan: seed.plan,
      // A client since the first month it paid; a new one (trial, internal) joined a week ago.
      since: payments.length ? shiftMonths(nextChargeOn, billingDay, -payments.length) : addDays(today, -8),
      billingDay,
      nextChargeOn,
      trialEndsOn: seed.trialFor !== undefined ? addDays(today, seed.trialFor) : null,
      graceUntil: null,
      usersUsed: seed.users,
      numbersUsed: seed.numbers,
      payments,
    };
  });
}
