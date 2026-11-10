import { Injectable, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { Session } from '../../core/session';
import type { Id, Order } from '../../shared/api/models';
import { formatNumber } from '../inventory/sale-units';
import { Confirm, type ConfirmRequest } from '../../shared/ui/confirm';
import { Toaster } from '../../shared/ui/toaster';
import type { OrderAction } from './orders.models';
import { OrdersRemote, type SaleOutcome } from './orders-remote';

const DONE_TOAST: Record<OrderAction, string> = {
  confirm: 'confirmado. Le avisamos al cliente por WhatsApp.',
  done: 'completado.',
  cancelled: 'cancelado.',
};

/**
 * Moves an order along, the same from «Pedidos», the chat's card and the order's page. Every move
 * asks first (confirming and completing write to the customer, cancelling undoes the sale) and the
 * dialog stays open with its loading circle until the server answers; an error shows inside it.
 * True when the order changed (the caller reloads it).
 */
@Injectable({ providedIn: 'root' })
export class OrderActions {
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(OrdersRemote) : null;
  private readonly session = inject(Session);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  /** Orders being moved right now: their buttons wait, so nothing is sent twice. */
  readonly running = signal<ReadonlySet<Id>>(new Set());

  isRunning(orderId: Id): boolean {
    return this.running().has(orderId);
  }

  async run(order: Order, action: OrderAction): Promise<boolean> {
    const tenantId = this.session.tenant()?.id;
    const remote = this.remote;
    if (!remote || !tenantId || this.isRunning(order.id)) return false;
    let outcome: SaleOutcome | undefined;
    this.mark(order.id, true);
    try {
      const done = await this.confirm.ask({
        ...this.question(order, action),
        action: async () => {
          outcome = action === 'confirm' ? await remote.confirm(tenantId, order.id) : await remote.setStatus(tenantId, order.id, action);
        },
      });
      if (!done) return false;
    } finally {
      this.mark(order.id, false);
    }
    this.toaster.show(`Pedido ${order.code} ${DONE_TOAST[action]}`);
    const short = outcome?.stockShortfalls ?? [];
    if (short.length) {
      const list = short.map((s) => `${s.name} (faltaron ${formatNumber(s.missing)})`).join(', ');
      this.toaster.show(`El inventario no alcanzaba: ${list}. Revísalo en Inventario.`, 'info');
    }
    return true;
  }

  private mark(orderId: Id, on: boolean): void {
    this.running.update((ids) => {
      const next = new Set(ids);
      if (on) next.add(orderId);
      else next.delete(orderId);
      return next;
    });
  }

  private question(order: Order, action: OrderAction): Omit<ConfirmRequest, 'action'> {
    const first = order.customerName.trim().split(/\s+/)[0];
    switch (action) {
      case 'confirm':
        return {
          title: `¿Confirmar el pedido ${order.code}?`,
          message: `Revisa el pago antes de confirmar. ${first} recibirá por WhatsApp que su pedido está confirmado, y si vendes con el inventario de Vortomi, los productos se descuentan.`,
          confirmLabel: 'Confirmar pedido',
        };
      case 'done':
        return {
          title: `¿Marcar el pedido ${order.code} como completado?`,
          message: `Es para cuando ya se entregó o se retiró. Si tu empresa envía recibos, ${first} recibe el suyo por WhatsApp en este momento.`,
          confirmLabel: 'Marcar completado',
        };
      case 'cancelled':
        return {
          title: `¿Cancelar el pedido ${order.code}?`,
          message: 'El pedido queda cancelado y, si ya estaba pagado, los productos vuelven al inventario. Al cliente no se le envía ningún mensaje.',
          confirmLabel: 'Sí, cancelar',
          cancelLabel: 'No, volver',
          danger: true,
        };
    }
  }
}
