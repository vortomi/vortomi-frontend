import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { Session } from '../../core/session';
import type { Id, Order } from '../../shared/api/models';
import { OrderActions } from './order-actions';
import { OrderSummary } from './order-summary';
import { type OrderAction, isOpenOrder } from './orders.models';
import { OrdersRemote } from './orders-remote';

/**
 * The open orders of a conversation, on top of the chat: the person who continues it sees the order
 * the agent took without reading the whole chat. Reloaded whenever the conversation changes.
 */
@Component({
  selector: 'app-conversation-orders',
  imports: [OrderSummary],
  template: `
    @for (order of open(); track order.id) {
      <section class="card order"><app-order-summary [order]="order" (moved)="move(order, $event)" /></section>
    }
  `,
  host: { '[class.none]': '!open().length' },
  styles: `
    :host { display: flex; flex-direction: column; gap: 8px; padding: 10px 16px 0; max-height: 45vh; overflow-y: auto; }
    :host(.none) { display: none; }
    .order { padding: 12px 14px; border: 1px solid var(--color-primary-soft); background: var(--color-primary-softer); }
  `,
})
export class ConversationOrders {
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(OrdersRemote) : null;
  private readonly session = inject(Session);
  private readonly actions = inject(OrderActions);

  readonly conversationId = input.required<Id>();
  /** Anything that changes when the conversation does (last activity, hand-off): reloads the orders. */
  readonly version = input<string>('');

  private readonly orders = signal<Order[]>([]);
  protected readonly open = computed(() => this.orders().filter(isOpenOrder));

  constructor() {
    effect(() => {
      const conversationId = this.conversationId();
      this.version();
      untracked(() => void this.load(conversationId));
    });
  }

  protected async move(order: Order, action: OrderAction): Promise<void> {
    if (await this.actions.run(order, action)) await this.load(order.conversationId);
  }

  private async load(conversationId: Id): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    try {
      this.orders.set(await this.remote.list(tenantId, { conversationId }));
    } catch {
      // Secondary: the chat works without its order card.
    }
  }
}
