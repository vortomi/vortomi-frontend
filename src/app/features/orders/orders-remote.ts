import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { DailyClose, Id, Order, OrderDetail, OrderStatus, StockShortfall } from '../../shared/api/models';

/** What moving an order to sold changed: the products the inventory did not have enough of. */
export interface SaleOutcome {
  stockShortfalls: StockShortfall[];
}

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
  setStatus(tenantId: Id, orderId: Id, status: Exclude<OrderStatus, 'confirmed'>): Promise<SaleOutcome> {
    return this.api.put(this.api.company(tenantId, `orders/${orderId}/status`), { status });
  }

  /** The bank's reference (it goes on the sale receipt) and what arrived ("1234.50"); empty clears each. */
  setPayment(tenantId: Id, orderId: Id, payment: { reference: string; receivedAmount: string }): Promise<void> {
    return this.api.put(this.api.company(tenantId, `orders/${orderId}/payment`), payment);
  }

  /** Confirms the order and tells the customer by WhatsApp (once). */
  confirm(tenantId: Id, orderId: Id): Promise<SaleOutcome> {
    return this.api.post(this.api.company(tenantId, `orders/${orderId}/confirm`));
  }

  /** The orders sold on a day ("2026-11-10"; today when left out), by payment method. */
  dailyClose(tenantId: Id, date?: string): Promise<DailyClose> {
    return this.api.get(this.api.company(tenantId, `orders/daily-close${date ? `?date=${encodeURIComponent(date)}` : ''}`));
  }
}
