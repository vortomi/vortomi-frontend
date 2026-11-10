import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Order } from '../../shared/api/models';
import { formatUsdCents, formatVes } from '../../shared/format/money';
import { Pill } from '../../shared/ui/pill';
import { OrderActions } from './order-actions';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderAction, lineCents, lineText, orderActions, orderTotalCents, toBs } from './orders.models';

/**
 * One order as the team reads it: what, how much, delivery or pickup, payment and notes, and the
 * buttons to move it along. Shared by the chat's order card, «Pedidos» and the order's page.
 */
@Component({
  selector: 'app-order-summary',
  imports: [Pill, RouterLink],
  template: `
    @let o = order();
    <div class="top">
      <b class="code">Pedido {{ o.code }}</b>
      <app-pill [tone]="tone[o.status]" [dot]="true">{{ statusLabel[o.status] }}</app-pill>
      <span class="who">{{ o.customerName }}</span>
    </div>
    <ul class="lines">
      @for (line of o.lines; track $index) {
        <li><span>{{ lineText(line) }}</span><span>{{ usd(lineCents(line)) }}</span></li>
      }
      <li class="muted">
        @if (o.fulfillment === 'pickup') {
          <span>Retira en la tienda</span><span>—</span>
        } @else {
          <span>Delivery{{ o.zone ? ' · ' + o.zone : '' }}</span>
          <span>{{ o.deliveryCents === null ? 'Por confirmar' : usd(o.deliveryCents) }}</span>
        }
      </li>
      <li class="total"><span>Total</span><span>{{ usd(total()) }}@if (totalBs(); as bs) { <small>{{ bs }}</small> }</span></li>
    </ul>
    @if (o.fulfillment === 'delivery' && o.deliveryCents === null) { <p class="warn">El costo del delivery no está en el total: confírmalo con el cliente.</p> }
    <dl>
      @if (o.address) { <dt>Dirección</dt><dd>{{ o.address }}</dd> }
      <dt>Pago</dt><dd>{{ o.paymentMethod?.name ?? 'Sin método' }}</dd>
      <dt>Comprobante</dt><dd>{{ receiptText() }}</dd>
      @if (o.notes) { <dt>Notas</dt><dd>{{ o.notes }}</dd> }
    </dl>
    <div class="actions">
      @if (detailLink()) { <a class="btn btn--sm detail" [routerLink]="['/orders', o.id]"><span>Ver detalle</span></a> }
      @for (b of actions(); track b.action) {
        <button type="button" class="btn btn--sm" [class.btn--primary]="b.style === 'primary'" [class.btn--success]="b.style === 'success'"
          [class.btn--ghost]="b.style === 'plain'" [disabled]="busy()" (click)="moved.emit(b.action)"><span>{{ b.label }}</span></button>
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; font-size: 14px; color: var(--color-text-2); }
    .top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .code { font-size: 15px; color: var(--color-text); }
    .who { color: var(--color-text-muted); margin-left: auto; }
    .lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .lines li { display: flex; justify-content: space-between; gap: 12px; }
    .lines .muted { color: var(--color-text-muted); }
    .lines .total { border-top: 1px solid var(--color-border); padding-top: 8px; font-weight: 700; color: var(--color-text); }
    .total small { display: block; text-align: right; font-weight: 400; color: var(--color-text-muted); font-size: 12px; }
    .warn { font-size: 13px; color: var(--color-warning-text); background: var(--color-warning-soft); border-radius: var(--radius-sm); padding: 6px 10px; margin: 0; }
    dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; margin: 0; }
    dt { color: var(--color-text-muted); }
    dd { margin: 0; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .actions:empty { display: none; }
    .detail { margin-right: auto; }
  `,
})
export class OrderSummary {
  private readonly mover = inject(OrderActions);

  readonly order = input.required<Order>();
  /** Off on the order's own page. */
  readonly detailLink = input(true);
  /** What the person chose to do with it. */
  readonly moved = output<OrderAction>();

  protected readonly statusLabel = ORDER_STATUS_LABEL;
  protected readonly lineText = lineText;
  protected readonly lineCents = lineCents;
  protected readonly tone = ORDER_STATUS_TONE;
  protected readonly actions = computed(() => orderActions(this.order().status));
  /** Its move is in progress (the confirmation dialog is open or the server is answering). */
  protected readonly busy = computed(() => this.mover.running().has(this.order().id));
  protected readonly receiptText = computed(() => {
    const count = this.order().receiptCount;
    return count === 0 ? 'Aún no lo envía' : count === 1 ? 'Recibido' : `${count} recibidos`;
  });
  protected readonly total = computed(() => orderTotalCents(this.order()));
  protected readonly totalBs = computed(() => {
    const bs = toBs(this.total(), this.order().bsPerUsd);
    return bs === null ? null : formatVes(bs);
  });

  protected usd(cents: number): string {
    return formatUsdCents(cents);
  }
}
