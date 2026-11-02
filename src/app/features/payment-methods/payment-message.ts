import type { PaymentMethod } from '../../shared/api/models';

// The WhatsApp message with an order's payment data, for the editor's preview. The server writes the
// real one: keep in sync with vortomi-backend/src/modules/payment-methods/payment-message.ts.

const number = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Bs 1.234,56", "USD 12,50"; null in bolívares while there is no exchange rate. */
export function amountText(cents: number, method: Pick<PaymentMethod, 'currency' | 'type'>, bsPerUsd: string | null): string | null {
  const usd = cents / 100;
  if (method.currency !== 'VES') return `${method.type === 'binance' ? 'USDT' : 'USD'} ${number.format(usd)}`;
  if (!bsPerUsd) return null;
  return `Bs ${number.format(Math.round(usd * Number(bsPerUsd) * 100) / 100)}`;
}

export type MessageMethod = Pick<PaymentMethod, 'type' | 'name' | 'currency' | 'fields' | 'instructions' | 'referenceRule' | 'receiptRule'>;

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function paymentMessage(method: MessageMethod, order: { customerName: string; totalCents: number; bsPerUsd: string | null }): string {
  const proof = method.receiptRule !== 'none' || method.referenceRule !== 'none';
  const amount = amountText(order.totalCents, method, order.bsPerUsd);
  const lines = [
    proof
      ? `¡Perfecto, ${firstName(order.customerName)}! Para registrar tu pedido, por favor realiza el pago por ${method.name}:`
      : `¡Perfecto, ${firstName(order.customerName)}! Tu pedido se paga con ${method.name}:`,
    '',
  ];
  for (const field of method.fields) lines.push(`${field.label}: ${field.value}`);
  if (method.type !== 'arrange') lines.push(`Monto a pagar: ${amount ?? 'te lo confirmamos en un momento'}`);
  if (method.currency === 'EUR') lines.push('El equivalente en euros te lo confirmamos en un momento.');
  lines.push('', method.instructions || closing(method));
  return lines.join('\n').trimEnd();
}

function closing(method: MessageMethod): string {
  if (method.receiptRule !== 'none') {
    return method.referenceRule === 'required'
      ? 'Cuando pagues, envíanos por aquí el capture del comprobante, con el número de referencia visible.'
      : 'Cuando pagues, envíanos por aquí el capture del comprobante.';
  }
  if (method.referenceRule !== 'none') return 'Cuando pagues, envíanos por aquí el número de referencia.';
  return 'Lo revisamos y te confirmamos en breve.';
}
