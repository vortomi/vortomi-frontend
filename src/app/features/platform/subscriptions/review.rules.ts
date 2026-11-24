import type { ReviewDetail } from '../../../shared/api/subscriptions';
import { formatUsdCents } from '../../../shared/format/money';
import { addMonthsOn } from '../../../shared/format/billing-dates';
import { dayText } from './billing.rules';

/** What each datum of a payment's payer is, as the console reads it. */
export const PAYER_LABEL: Record<string, string> = {
  bank: 'Banco',
  phone: 'Teléfono',
  document: 'Cédula o RIF',
  holder: 'Titular',
  senderName: 'Quién envió',
  senderContact: 'Correo o teléfono de Zelle',
  sender: 'Binance ID, correo o teléfono',
  senderEmail: 'Correo de PayPal',
  receivedBy: 'Lo recibió',
};

export const REJECTION_REASONS = [
  { value: 'reference_not_found', label: 'Referencia no encontrada' },
  { value: 'amount_mismatch', label: 'El monto no coincide' },
  { value: 'unreadable_proof', label: 'El comprobante no se lee' },
  { value: 'wrong_method', label: 'No llegó a ese método' },
  { value: 'other', label: 'Otro motivo' },
] as const;

export { addMonthsOn } from '../../../shared/format/billing-dates';

/** What approving does (mockup web-41, frame 3), for the cents that really arrived. */
export function approvalSteps(d: ReviewDetail, receivedCents: number): string[] {
  const steps: string[] = [];
  const money = formatUsdCents;
  if (d.charge) {
    const remaining = d.charge.amountCents - d.charge.paidCents;
    const applied = Math.min(receivedCents, remaining);
    const months = `${d.charge.months} ${d.charge.months === 1 ? 'mes' : 'meses'}`;
    const complete = applied >= remaining;
    steps.push(complete ? `Abona ${money(applied)} a su cobro de ${months}: queda pagado.` : `Abona ${money(applied)} a su cobro de ${months}: sigue debiendo ${money(remaining - applied)}.`);
    if (complete) {
      const billingDay = d.billingDay ?? Number(d.payment.paidOn.slice(8, 10));
      const from = d.billingDay === null ? d.payment.paidOn : d.charge.dueOn;
      if (d.billingDay === null) steps.push(`Su día de cobro queda fijo: los ${billingDay} de cada mes.`);
      steps.push(`Su próximo pago vence el ${dayText(addMonthsOn(from, d.charge.months, billingDay), true)}.`);
    }
    if (receivedCents > applied) steps.push(`Los ${money(receivedCents - applied)} de más van a su saldo a favor.`);
  } else {
    steps.push(`No debe nada: es un pago adelantado. Si cubre el próximo período, lo paga y mueve su fecha; si no, va a su saldo a favor.`);
  }
  steps.push('Se genera su recibo en PDF.');
  return steps;
}
