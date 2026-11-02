import type { Order, OrderLine, OrderStatus, Tone } from '../../shared/api/models';
import { formatNumber, formatQuantity, takesDecimals } from '../inventory/sale-units';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Esperando pago',
  payment_review: 'Pago por revisar',
  confirmed: 'Confirmado',
  done: 'Completado',
  cancelled: 'Cancelado',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  awaiting_payment: 'amber',
  payment_review: 'blue',
  confirmed: 'violet',
  done: 'green',
  cancelled: 'neutral',
};

/** Still in someone's hands: shown on the chat's order card. */
export const isOpenOrder = (order: Order) => order.status !== 'done' && order.status !== 'cancelled';

/** What a person can do with an order: confirm it (the customer is told), complete it or cancel it. */
export type OrderAction = 'confirm' | 'done' | 'cancelled';

export interface OrderActionButton {
  action: OrderAction;
  label: string;
  style: 'primary' | 'success' | 'plain';
}

/** The buttons of each status, the main one first. */
export function orderActions(status: OrderStatus): OrderActionButton[] {
  switch (status) {
    case 'awaiting_payment':
    case 'payment_review':
      return [
        { action: 'confirm', label: 'Confirmar pedido', style: 'primary' },
        { action: 'cancelled', label: 'Cancelar', style: 'plain' },
      ];
    case 'confirmed':
      return [
        { action: 'done', label: 'Completado', style: 'success' },
        { action: 'cancelled', label: 'Cancelar', style: 'plain' },
      ];
    default:
      return [];
  }
}

/** What a line costs: quantity × unit price, rounded to the cent as the server does (0,15 kg × $9,99 = $1,50). */
export const lineCents = (line: OrderLine) => Math.round((Math.round(line.quantity * 100) * line.unitPriceCents) / 100);

/** "2 × Recarga 19L", or "0,15 kg de Queso blanco" for what is sold by weight, length... */
export const lineText = (line: OrderLine) =>
  takesDecimals(line.saleUnit) ? `${formatQuantity(line.quantity, line.saleUnit)} de ${line.name}` : `${formatNumber(line.quantity)} × ${line.name}`;

/** What the order adds up to with what is known: the delivery is left out while a person confirms it. */
export const orderTotalCents = (order: Order) => order.subtotalCents + (order.deliveryCents ?? 0);

/** Bolívares at the rate the order was priced with; null when it had none. */
export const toBs = (cents: number, bsPerUsd: string | null) => (bsPerUsd ? (cents / 100) * Number(bsPerUsd) : null);
