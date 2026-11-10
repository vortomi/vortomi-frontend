import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { Order, OrderStatus } from '../../shared/api/models';
import { calendarDay, formatListStamp, formatTime } from '../../shared/format/date-time';
import { formatUsdCents, formatVes } from '../../shared/format/money';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { type MenuOption, SelectMenu, normalize } from '../../shared/ui/select-menu';
import { Skeleton } from '../../shared/ui/skeleton';
import { OrderActions } from './order-actions';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderAction, lineText, orderTotalCents, toBs } from './orders.models';
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
const ALL_METHODS = 'all';
const NO_METHOD = 'none';

/**
 * «Pedidos» (mockup web-15): the orders the sales agent took, newest first, as a table, with what
 * needs attention counted on top. Each person sees those of the conversations they see; whoever
 * attends one reviews its payment (order page), completes or cancels it.
 */
@Component({
  selector: 'app-orders-page',
  imports: [Avatar, Icon, Pill, RouterLink, SelectMenu, Skeleton],
  template: `
    <header class="page-top">
      <div>
        <h1>Pedidos</h1>
        <span class="sub">Los que arma el agente con tus clientes.</span>
      </div>
      <a class="btn close-link" routerLink="/orders/close"><app-icon name="calendar" /><span>Cierre del día</span></a>
    </header>
    <div class="page-body">
      @if (!remote) {
        <div class="card"><p class="empty-state"><app-icon name="package" />Los pedidos se ven con el servidor.</p></div>
      } @else {
        @if (loadError(); as error) {
          <div class="form-alert" role="alert"><app-icon name="alert" /><span class="grow">{{ error }}</span><button type="button" class="btn btn--sm" (click)="retry()"><span>Reintentar</span></button></div>
        }
        <section class="stats" aria-label="Resumen">
          @for (s of stats(); track s.label) {
            <div class="card stat">
              <span class="ic" [class]="s.tone"><app-icon [name]="s.icon" /></span>
              <div>
                <p>{{ s.label }}</p>
                @if (loaded()) { <b>{{ s.value }}</b> } @else { <span class="sk value"></span> }
              </div>
            </div>
          }
        </section>

        <section class="card table-card">
          <nav class="tabs-line" role="tablist" aria-label="Pedidos por estado">
            @for (v of views; track v.id) {
              <button type="button" role="tab" [class.on]="view() === v.id" [attr.aria-selected]="view() === v.id" (click)="view.set(v.id)">
                {{ v.label }}@if (count(v.id); as n) { <span class="count" [class.muted]="v.id !== 'payment_review'">{{ n }}</span> }
              </button>
            }
          </nav>
          <div class="tools">
            <label class="input search">
              <app-icon name="search" />
              <input type="search" placeholder="Código o cliente" aria-label="Buscar por código o cliente" [value]="query()" (input)="query.set(text($event))" />
            </label>
            @if (methodOptions().length > 2) {
              <app-select-menu class="method" label="Método de pago" [options]="methodOptions()" [value]="method()" (picked)="method.set($event)" />
            }
          </div>

          @if (!loaded()) {
            <app-skeleton kind="table" [rows]="5" [cols]="6" />
          } @else if (shown().length) {
            <div class="scroll">
              <table class="data-table">
                <thead><tr><th>Pedido</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Pago</th><th>Estado</th><th><span class="visually-hidden">Acciones</span></th></tr></thead>
                <tbody>
                  @for (o of shown(); track o.id) {
                    <tr class="clickable" (click)="open(o)">
                      <td><b class="code">{{ o.code }}</b><small>{{ when(o.createdAt) }}</small></td>
                      <td>
                        <div class="who">
                          <app-avatar [name]="o.customerName" [seed]="o.conversationId" />
                          <div><span>{{ o.customerName }}</span><small>{{ fulfillment(o) }}</small></div>
                        </div>
                      </td>
                      <td class="lines">@for (line of o.lines; track $index) { <span>{{ lineText(line) }}</span> }</td>
                      <td><b>{{ usd(total(o)) }}</b>@if (bs(o); as v) { <small>{{ v }}</small> }</td>
                      <td>{{ o.paymentMethod?.name ?? 'Sin método' }}</td>
                      <td><app-pill [tone]="tone[o.status]" [dot]="true">{{ statusLabel[o.status] }}</app-pill></td>
                      <td class="row-actions" (click)="$event.stopPropagation()">
                        @if (o.status === 'payment_review' || o.status === 'awaiting_payment') {
                          <a class="btn btn--sm" [class.btn--primary]="o.status === 'payment_review'" [routerLink]="['/orders', o.id]"><span>Revisar</span></a>
                        } @else if (o.status === 'confirmed') {
                          <button type="button" class="btn btn--sm btn--success" [disabled]="actions.isRunning(o.id)" (click)="move(o, 'done')"><span>Completado</span></button>
                        } @else {
                          <a class="btn btn--sm" [routerLink]="['/orders', o.id]"><span>Ver</span></a>
                        }
                        <a class="icon-btn" [routerLink]="['/inbox', o.conversationId]" aria-label="Ver la conversación"><app-icon name="chat" /></a>
                        @if (o.status !== 'done' && o.status !== 'cancelled') {
                          <button type="button" class="icon-btn danger" aria-label="Cancelar el pedido" [disabled]="actions.isRunning(o.id)" (click)="move(o, 'cancelled')"><app-icon name="x" /></button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="empty-state"><app-icon name="package" />{{ query() || method() !== allMethods ? 'Ningún pedido coincide con la búsqueda.' : 'No hay pedidos aquí.' }}</p>
          }
        </section>
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .close-link { margin-left: auto; }
    .form-alert { align-items: center; }
    .grow { flex: 1; }
    .page-body { display: flex; flex-direction: column; gap: 18px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat { padding: 16px 18px; display: flex; gap: 14px; align-items: center; }
    .stat .ic { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex: none; --icon-size: 22px; }
    .ic.blue { background: var(--color-info-soft); color: var(--color-info-text); }
    .ic.amber { background: var(--color-warning-soft); color: var(--color-warning-text); }
    .ic.green { background: var(--color-success-soft); color: var(--color-success-text); }
    .ic.violet { background: var(--color-violet-soft); color: var(--color-violet-text); }
    .stat p { font-size: 13px; color: var(--color-text-muted); }
    .stat b { display: block; font-size: 22px; font-weight: 700; margin-top: 2px; color: var(--color-text); }
    .stat .value { width: 60px; height: 22px; margin-top: 4px; }
    .tabs-line { padding: 0 12px; }
    .tabs-line .count.muted { background: var(--color-surface-hover); color: var(--color-text-muted); }
    .tools { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--color-border); flex-wrap: wrap; }
    .search { display: flex; align-items: center; gap: 8px; width: 280px; max-width: 100%; height: 40px; --icon-size: 16px; color: var(--color-text-muted); }
    .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--color-text); font-size: 14px; }
    .search:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
    .method { margin-left: auto; width: 230px; }
    .scroll { overflow-x: auto; }
    td small { display: block; font-size: 12.5px; color: var(--color-text-muted); margin-top: 2px; white-space: nowrap; }
    .code { color: var(--color-text); white-space: nowrap; }
    .who { display: flex; align-items: center; gap: 10px; }
    .who span { color: var(--color-text); font-weight: 500; white-space: nowrap; }
    .lines span { display: block; }
    .row-actions { white-space: nowrap; text-align: right; }
    .row-actions > * { vertical-align: middle; margin-left: 4px; }
  `,
})
export class OrdersPage {
  protected readonly remote = inject(API_CONFIG).mode === 'api' ? inject(OrdersRemote) : null;
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  protected readonly actions = inject(OrderActions);

  protected readonly views = VIEWS;
  protected readonly statusLabel = ORDER_STATUS_LABEL;
  protected readonly tone = ORDER_STATUS_TONE;
  protected readonly lineText = lineText;
  protected readonly allMethods = ALL_METHODS;
  protected readonly view = signal<View>('payment_review');
  protected readonly query = signal('');
  protected readonly method = signal<string>(ALL_METHODS);
  protected readonly loaded = signal(false);
  /** The last read failed: said once on top, with a retry, instead of a toast every 30 seconds. */
  protected readonly loadError = signal<string | null>(null);
  private readonly orders = signal<Order[]>([]);

  /** What needs someone, and today's sales, from the orders already on screen (the latest 200). */
  protected readonly stats = computed(() => {
    const list = this.orders();
    const timezone = this.session.timezone();
    const today = calendarDay(new Date().toISOString(), timezone);
    const soldToday = list.filter((o) => (o.status === 'confirmed' || o.status === 'done') && o.confirmedAt && calendarDay(o.confirmedAt, timezone) === today);
    return [
      { label: 'Por revisar', value: String(this.count('payment_review')), icon: 'eye' as const, tone: 'blue' },
      { label: 'Esperando pago', value: String(this.count('awaiting_payment')), icon: 'clip' as const, tone: 'amber' },
      { label: 'Vendido hoy', value: formatUsdCents(soldToday.reduce((sum, o) => sum + orderTotalCents(o), 0)), icon: 'check' as const, tone: 'green' },
      { label: 'Pedidos de hoy', value: String(list.filter((o) => calendarDay(o.createdAt, timezone) === today).length), icon: 'package' as const, tone: 'violet' },
    ];
  });

  /** The payment methods of the orders on screen, to narrow the table. */
  protected readonly methodOptions = computed<MenuOption[]>(() => {
    const names = new Map<string, string>();
    for (const o of this.orders()) names.set(o.paymentMethod?.id ?? NO_METHOD, o.paymentMethod?.name ?? 'Sin método');
    return [{ value: ALL_METHODS, label: 'Todos los métodos' }, ...[...names].map(([value, label]) => ({ value, label }))];
  });

  protected readonly shown = computed(() => {
    const view = this.view();
    const needle = normalize(this.query());
    const method = this.method();
    return this.orders().filter(
      (o) =>
        (view === 'all' || o.status === view) &&
        (method === ALL_METHODS || (o.paymentMethod?.id ?? NO_METHOD) === method) &&
        (!needle || normalize(`${o.code} ${o.customerName} ${o.contactName ?? ''}`).includes(needle)),
    );
  });

  constructor() {
    void this.load();
    const timer = setInterval(() => void this.load(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected count(view: View): number {
    return view === 'all' ? 0 : this.orders().filter((o) => o.status === view).length;
  }

  protected retry(): void {
    void this.load();
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** "10:21" today, "Ayer", or "6 nov", on the company clock. */
  protected when(iso: string): string {
    const timezone = this.session.timezone();
    const stamp = formatListStamp(iso, new Date(), timezone);
    return stamp === formatTime(iso, timezone) ? `Hoy ${stamp}` : stamp;
  }

  protected fulfillment(order: Order): string {
    return order.fulfillment === 'pickup' ? 'Retira en la tienda' : `Delivery${order.zone ? ` · ${order.zone}` : ''}`;
  }

  protected total(order: Order): number {
    return orderTotalCents(order);
  }

  protected usd(cents: number): string {
    return formatUsdCents(cents);
  }

  protected bs(order: Order): string | null {
    const bs = toBs(orderTotalCents(order), order.bsPerUsd);
    return bs === null ? null : formatVes(bs);
  }

  protected open(order: Order): void {
    void this.router.navigate(['/orders', order.id]);
  }

  protected async move(order: Order, action: OrderAction): Promise<void> {
    if (await this.actions.run(order, action)) await this.load();
  }

  private async load(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    try {
      this.orders.set(await this.remote.list(tenantId));
      this.loadError.set(null);
    } catch (error) {
      // What is on screen stays; the alert says the list may be out of date.
      this.loadError.set(toApiFailure(error).message);
    } finally {
      this.loaded.set(true);
    }
  }
}
