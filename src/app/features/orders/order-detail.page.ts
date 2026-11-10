import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { Id, OrderDetail } from '../../shared/api/models';
import { formatShortDate, formatTime } from '../../shared/format/date-time';
import { formatAmount } from '../../shared/format/money';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { OrderSaleReceipt } from '../receipts/order-sale-receipt';
import { OrderActions } from './order-actions';
import { OrderPaymentCheck } from './order-payment-check';
import { OrderSummary } from './order-summary';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderAction } from './orders.models';
import { OrdersRemote } from './orders-remote';

/** A receipt the customer sent, ready to show: its file lives in this tab only (an object URL). */
interface ShownReceipt {
  mediaId: Id;
  url: string | null;
  isImage: boolean;
  isPdf: boolean;
  createdAt: string;
}

/** "el pedido P-7K3F9Q" or "los pedidos P-1, P-2". */
const orderList = (codes: string[]) => (codes.length === 1 ? `el pedido ${codes[0]}` : `los pedidos ${codes.join(', ')}`);

/** A receipt sent while the page is open shows up without reloading it. */
const REFRESH_MS = 30_000;

/**
 * One order in full, for the person who reviews its payment: what was ordered, delivery, payment
 * method, the receipts the customer sent and the payment's reference, the buttons to confirm (the
 * customer is told), complete or cancel it, and the sale receipt it got.
 */
@Component({
  selector: 'app-order-detail-page',
  imports: [Icon, OrderPaymentCheck, OrderSaleReceipt, OrderSummary, Pill, RouterLink],
  template: `
    <header class="page-top">
      <nav class="crumbs"><a routerLink="/orders">Pedidos</a> / <span>{{ order()?.code ?? '…' }}</span></nav>
      @if (order(); as o) { <app-pill [tone]="tone[o.status]">{{ statusLabel[o.status] }}</app-pill> }
    </header>
    <div class="page-body">
      @if (missing()) {
        <p class="empty">Ese pedido ya no existe o no lo puedes ver. <a routerLink="/orders">Volver a Pedidos</a></p>
      } @else if (order(); as o) {
        <div class="layout">
          <div class="col">
            <section class="card box"><app-order-summary [order]="o" [detailLink]="false" (moved)="move($event)" /></section>
            <section class="card box">
              <h2>Cliente</h2>
              <dl class="facts">
                <dt>Pedido a nombre de</dt><dd>{{ o.customerName }}</dd>
                @if (o.contactName && o.contactName !== o.customerName) { <dt>Contacto en WhatsApp</dt><dd>{{ o.contactName }}</dd> }
                <dt>Recibido</dt><dd>{{ stamp(o.createdAt) }}</dd>
                @if (o.confirmedAt) { <dt>Pago confirmado</dt><dd>{{ stamp(o.confirmedAt) }}{{ o.confirmedBy ? ' por ' + o.confirmedBy : '' }}</dd> }
              </dl>
              <a class="link chat" [routerLink]="['/inbox', o.conversationId]"><app-icon name="chat" />Ver conversación</a>
            </section>
          </div>
          <div class="col">
            <section class="card box receipts">
              <h2>Comprobante de pago</h2>
              @if (warnings().length) {
                <ul class="alerts" role="alert">
                  @for (w of warnings(); track w) { <li><app-icon name="alert" />{{ w }}</li> }
                </ul>
              }
              @if (receipts().length) {
                @for (r of receipts(); track r.mediaId) {
                  <figure>
                    @if (!r.url) {
                      <div class="placeholder">Cargando…</div>
                    } @else if (r.isImage) {
                      <a [href]="r.url" target="_blank" rel="noopener" title="Abrir en grande"><img [src]="r.url" alt="Comprobante de pago enviado por el cliente" /></a>
                    } @else {
                      <a class="btn" [href]="r.url" target="_blank" rel="noopener" [attr.download]="r.isPdf ? null : 'comprobante'">
                        <app-icon name="clip" />{{ r.isPdf ? 'Abrir el PDF' : 'Descargar el archivo' }}
                      </a>
                    }
                    <figcaption>Enviado el {{ stamp(r.createdAt) }}</figcaption>
                  </figure>
                }
              } @else {
                <p class="empty">{{ noReceiptText() }}</p>
              }
              @if (o.status !== 'cancelled') { <app-order-payment-check [order]="o" (saved)="load()" /> }
            </section>
            <section class="card box"><app-order-sale-receipt [order]="o" (sent)="load()" /></section>
          </div>
        </div>
      } @else {
        <p class="empty">Cargando…</p>
      }
    </div>
  `,
  styleUrls: ['../../shared/ui/section.scss'],
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .crumbs { font-size: 13.5px; color: var(--color-text-muted); }
    .crumbs span { color: var(--color-text); font-weight: 500; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
    @media (max-width: 1000px) { .layout { grid-template-columns: minmax(0, 1fr); } }
    .col { display: flex; flex-direction: column; }
    .chat { display: inline-flex; align-items: center; gap: 6px; --icon-size: 15px; font-size: 13px; align-self: flex-start; }
    figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
    img { display: block; max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-surface-muted); }
    figcaption { font-size: 12.5px; color: var(--color-text-muted); }
    .placeholder { height: 160px; border-radius: 10px; background: var(--color-surface-muted); display: flex; align-items: center; justify-content: center;
      color: var(--color-text-muted); font-size: 13px; }
    .btn { align-self: flex-start; }
    .alerts { list-style: none; margin: 0; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--color-warning);
      color: var(--color-warning); font-size: 13px; display: flex; flex-direction: column; gap: 6px; }
    .alerts li { display: flex; gap: 8px; align-items: flex-start; --icon-size: 16px; }
  `,
})
export class OrderDetailPage {
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(OrdersRemote) : null;
  private readonly session = inject(Session);
  private readonly actions = inject(OrderActions);
  private readonly orderId = inject(ActivatedRoute).snapshot.paramMap.get('orderId')!;

  protected readonly statusLabel = ORDER_STATUS_LABEL;
  protected readonly tone = ORDER_STATUS_TONE;
  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly missing = signal(false);
  /** Files already fetched, by receipt: fetched once, released when the page closes. */
  private readonly files = signal<Record<Id, string>>({});
  protected readonly receipts = computed((): ShownReceipt[] =>
    (this.order()?.receipts ?? []).map((r) => ({
      mediaId: r.mediaId,
      url: this.files()[r.mediaId] ?? null,
      isImage: r.mimeType.startsWith('image/'),
      isPdf: r.mimeType === 'application/pdf',
      createdAt: r.createdAt,
    })),
  );
  /** What does not add up in the payment, in plain words, before anyone confirms it. */
  protected readonly warnings = computed(() => {
    const o = this.order();
    if (!o || o.status === 'cancelled') return [];
    const { referenceUsedIn, receiptUsedIn, shortBy } = o.alerts;
    const list: string[] = [];
    if (referenceUsedIn.length) list.push(`Esta referencia ya está en ${orderList(referenceUsedIn)}. Puede ser un pago reutilizado.`);
    if (receiptUsedIn.length) list.push(`Este mismo comprobante ya llegó para ${orderList(receiptUsedIn)}.`);
    if (shortBy) list.push(`Llegó menos de lo que cuesta el pedido: faltan ${formatAmount(Number(shortBy), o.paymentMethod?.currency ?? 'USD')}.`);
    return list;
  });
  protected readonly noReceiptText = computed(() => {
    const o = this.order();
    if (!o?.paymentMethod) return 'Este pedido no tiene método de pago: acuerda el pago con el cliente por el chat.';
    if (o.status === 'awaiting_payment') return 'El cliente aún no envía el comprobante. Cuando mande el capture por el chat, aparece aquí.';
    return 'Este pedido no tiene comprobante (por ejemplo, pago en efectivo).';
  });

  constructor() {
    void this.load();
    const timer = setInterval(() => void this.load(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      for (const url of Object.values(this.files())) URL.revokeObjectURL(url);
    });
  }

  /** "29 oct 2026, 15:40", on the company clock. */
  protected stamp(iso: string): string {
    const timezone = this.session.timezone();
    return `${formatShortDate(iso, timezone)}, ${formatTime(iso, timezone)}`;
  }

  protected async move(action: OrderAction): Promise<void> {
    const order = this.order();
    if (order && (await this.actions.run(order, action))) await this.load();
  }

  protected async load(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    try {
      const order = await this.remote.detail(tenantId, this.orderId);
      this.order.set(order);
      await Promise.all(order.receipts.filter((r) => !this.files()[r.mediaId]).map((r) => this.fetchFile(tenantId, r.mediaId)));
    } catch (error) {
      if (toApiFailure(error).status === 404) this.missing.set(true);
    }
  }

  private async fetchFile(tenantId: Id, mediaId: Id): Promise<void> {
    if (!this.remote) return;
    try {
      const url = URL.createObjectURL(await this.remote.receipt(tenantId, this.orderId, mediaId));
      this.files.update((files) => ({ ...files, [mediaId]: url }));
    } catch {
      // The receipt stays "Cargando…"; the next refresh tries again.
    }
  }
}
