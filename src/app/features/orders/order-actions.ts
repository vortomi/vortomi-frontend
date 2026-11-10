import { Injectable, inject } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { Order } from '../../shared/api/models';
import { formatNumber } from '../inventory/sale-units';
import { Confirm } from '../../shared/ui/confirm';
import { Toaster } from '../../shared/ui/toaster';
import type { OrderAction } from './orders.models';
import { OrdersRemote } from './orders-remote';

const DONE_TOAST: Record<OrderAction, string> = {
  confirm: 'confirmado. Le avisamos al cliente por WhatsApp.',
  done: 'completado.',
  cancelled: 'cancelado.',
};

/**
 * Moves an order along, the same from «Pedidos», the chat's card and the order's page. Confirming
 * writes to the customer, so it asks first. True when the order changed (the caller reloads it).
 */
@Injectable({ providedIn: 'root' })
export class OrderActions {
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(OrdersRemote) : null;
  private readonly session = inject(Session);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  async run(order: Order, action: OrderAction): Promise<boolean> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return false;
    if (!(await this.ask(order, action))) return false;
    try {
      const outcome = action === 'confirm' ? await this.remote.confirm(tenantId, order.id) : await this.remote.setStatus(tenantId, order.id, action);
      this.toaster.show(`Pedido ${order.code} ${DONE_TOAST[action]}`);
      const short = outcome?.stockShortfalls ?? [];
      if (short.length) {
        const list = short.map((s) => `${s.name} (faltaron ${formatNumber(s.missing)})`).join(', ');
        this.toaster.show(`El inventario no alcanzaba: ${list}. Revísalo en Inventario.`, 'info');
      }
      return true;
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      return false;
    }
  }

  private ask(order: Order, action: OrderAction): Promise<boolean> {
    if (action === 'confirm') {
      return this.confirm.ask({
        title: `Confirmar el pedido ${order.code}`,
        message: `Revisa el pago antes de confirmar. ${order.customerName} recibirá por WhatsApp que su pedido está confirmado y que el equipo lo contactará para la entrega.`,
        confirmLabel: 'Confirmar pedido',
      });
    }
    if (action === 'cancelled') {
      return this.confirm.ask({ title: `Cancelar el pedido ${order.code}`, message: 'El pedido queda cancelado. Al cliente no se le envía ningún mensaje.', confirmLabel: 'Cancelar pedido', danger: true });
    }
    return Promise.resolve(true);
  }
}
