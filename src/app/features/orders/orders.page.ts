import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { Order, OrderStatus } from '../../shared/api/models';
import { formatShortDate, formatTime } from '../../shared/format/date-time';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { OrderActions } from './order-actions';
import { OrderSummary } from './order-summary';
import type { OrderAction } from './orders.models';
import { OrdersRemote } from './orders-remote';

type View = OrderStatus | 'all';

const VIEWS: { id: View; label: string }[] = [
  { id: 'payment_review', label: 'Por revisar' },
  { id: 'awaiting_payment', label: 'Esperando pago' },
  { id: 'confirmed', label: 'Confirmados' },
  { id: 'done', label: 'Completados' },
  { id: 'cancelled', label: 'Cancelados' },
  { id: 'all', label: 'Todos' },
];
/** New orders arrive while the page is open: it asks again every so often. */
const REFRESH_MS = 30_000;

/**
 * «Pedidos»: the orders the sales agent took, newest first. Each person sees those of the
 * conversations they see; whoever attends one reviews its payment, confirms, completes or cancels it.
 */
@Component({
  selector: 'app-orders-page',
  imports: [Icon, OrderSummary, RouterLink],
  template: `
    <header class="page-top">
      <h1>Pedidos</h1>
      <span class="sub">Los que arma el agente con tus clientes</span>
      <a class="btn close-link" routerLink="/orders/close"><app-icon name="chart" />Cierre del día</a>
    </header>
    <nav class="tabs" role="tablist" aria-label="Pedidos por estado">
      @for (v of views; track v.id) {
        <button type="button" role="tab" [class.on]="view() === v.id" [attr.aria-selected]="view() === v.id" (click)="view.set(v.id)">
          {{ v.label }}@if (v.id === 'payment_review' && toReview()) { <span class="count">{{ toReview() }}</span> }
        </button>
      }
    </nav>
    <div class="page-body">
      @if (!remote) {
        <p class="empty">Los pedidos se ven con el servidor.</p>
      } @else if (shown().length) {
        <div class="grid">
          @for (order of shown(); track order.id) {
            <section class="card order">
              <app-order-summary [order]="order" (moved)="move(order, $event)" />
              <footer>
                <span>{{ stamp(order.createdAt) }}</span>
                <a class="link" [routerLink]="['/inbox', order.conversationId]"><app-icon name="chat" />Ver conversación</a>
              </footer>
            </section>
          }
        </div>
      } @else {
        <p class="empty">{{ loaded() ? 'No hay pedidos aquí.' : 'Cargando…' }}</p>
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .close-link { margin-left: auto; --icon-size: 15px; }
    .tabs { display: flex; gap: 22px; padding: 0 26px; background: var(--color-surface); border-bottom: 1px solid var(--color-border); flex-shrink: 0; overflow-x: auto; }
    .tabs button { border: 0; background: none; padding: 12px 0; font-size: 13.5px; color: var(--color-text-muted); cursor: pointer; border-bottom: 2px solid transparent;
      white-space: nowrap; display: flex; align-items: center; gap: 6px; }
    .tabs button.on { color: var(--color-primary); font-weight: 600; border-bottom-color: var(--color-primary); }
    .count { background: var(--color-primary); color: #fff; border-radius: 999px; font-size: 11.5px; padding: 1px 7px; font-weight: 600; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
    .order { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
    footer { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: var(--color-text-muted);
      border-top: 1px solid var(--color-border-soft); padding-top: 10px; }
    footer .link { display: inline-flex; align-items: center; gap: 6px; --icon-size: 15px; }
    .empty { color: var(--color-text-muted); font-size: 14px; }
  `,
})
export class OrdersPage {
  protected readonly remote = inject(API_CONFIG).mode === 'api' ? inject(OrdersRemote) : null;
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);
  private readonly actions = inject(OrderActions);

  protected readonly views = VIEWS;
  protected readonly view = signal<View>('payment_review');
  protected readonly loaded = signal(false);
  private readonly orders = signal<Order[]>([]);
  protected readonly toReview = computed(() => this.orders().filter((o) => o.status === 'payment_review').length);
  protected readonly shown = computed(() => {
    const view = this.view();
    return view === 'all' ? this.orders() : this.orders().filter((o) => o.status === view);
  });

  constructor() {
    void this.load();
    const timer = setInterval(() => void this.load(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /** "29 oct 2026, 15:40", on the company clock. */
  protected stamp(iso: string): string {
    const timezone = this.session.timezone();
    return `${formatShortDate(iso, timezone)}, ${formatTime(iso, timezone)}`;
  }

  protected async move(order: Order, action: OrderAction): Promise<void> {
    if (await this.actions.run(order, action)) await this.load();
  }

  private async load(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    try {
      this.orders.set(await this.remote.list(tenantId));
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.loaded.set(true);
    }
  }
}
