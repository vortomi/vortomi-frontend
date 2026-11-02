import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { Id, Order, OrderDetail, OrderStatus } from '../../shared/api/models';

/** Orders against vortomi-backend ('api' mode). Each person gets the orders of the conversations they see. */
@Injectable({ providedIn: 'root' })
export class OrdersRemote {
  private readonly api = inject(ApiClient);

  async list(tenantId: Id, filters: { status?: OrderStatus; conversationId?: Id } = {}): Promise<Order[]> {
    const query = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => !!e[1])).toString();
    return (await this.api.get<{ items: Order[] }>(this.api.company(tenantId, `orders${query ? `?${query}` : ''}`))).items;
  }

  detail(tenantId: Id, orderId: Id): Promise<OrderDetail> {
    return this.api.get(this.api.company(tenantId, `orders/${orderId}`));
  }

  /** A payment receipt's file, with the session (an <img src> could not send it). */
  receipt(tenantId: Id, orderId: Id, mediaId: Id): Promise<Blob> {
    return this.api.blob(this.api.company(tenantId, `orders/${orderId}/receipts/${mediaId}`));
  }

  /** Done or cancelled; confirming goes through confirm(). */
  setStatus(tenantId: Id, orderId: Id, status: Exclude<OrderStatus, 'confirmed'>): Promise<void> {
    return this.api.put(this.api.company(tenantId, `orders/${orderId}/status`), { status });
  }

  /** The bank's reference of the payment (it goes on the sale receipt); empty clears it. */
  setPaymentReference(tenantId: Id, orderId: Id, reference: string): Promise<void> {
    return this.api.put(this.api.company(tenantId, `orders/${orderId}/payment-reference`), { reference });
  }

  /** Confirms the order and tells the customer by WhatsApp (once). */
  confirm(tenantId: Id, orderId: Id): Promise<void> {
    return this.api.post(this.api.company(tenantId, `orders/${orderId}/confirm`));
  }
}
