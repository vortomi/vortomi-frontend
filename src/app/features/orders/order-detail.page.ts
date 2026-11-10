import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { Id, OrderDetail } from '../../shared/api/models';
import { formatShortDate, formatTime } from '../../shared/format/date-time';
import { formatAmount, formatUsdCents, formatVes } from '../../shared/format/money';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Skeleton } from '../../shared/ui/skeleton';
import { OrderSaleReceipt } from '../receipts/order-sale-receipt';
import { OrderActions } from './order-actions';
import { OrderPaymentCheck } from './order-payment-check';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderAction, lineCents, lineText, orderActions, orderTotalCents, toBs } from './orders.models';
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
 * One order in full (mockup web-16), for the person who reviews its payment: what was ordered and
 * for whom on the left; the payment review (alerts, the receipts the customer sent, reference and
 * amount received) and the sale receipt on the right; confirm, complete or cancel on top.
 */
@Component({
  selector: 'app-order-detail-page',
  imports: [Icon, OrderPaymentCheck, OrderSaleReceipt, Pill, RouterLink, Skeleton],
  template: `
    <header class="page-top">
      <div class="title">
        <nav class="crumbs" aria-label="Ruta"><a routerLink="/orders">Pedidos</a><app-icon name="chev-right" /><span>{{ order()?.code ?? '…' }}</span></nav>
        <h1>
          Pedido {{ order()?.code ?? '' }}
          @if (order(); as o) { <app-pill [tone]="tone[o.status]" [dot]="true">{{ statusLabel[o.status] }}</app-pill> }
        </h1>
      </div>
      @if (order(); as o) {
        <div class="head-actions">
          <a class="btn" [routerLink]="['/inbox', o.conversationId]"><app-icon name="chat" /><span>Ver conversación</span></a>
          @for (b of buttons(); track b.action) {
            <button type="button" class="btn" [class.btn--primary]="b.style === 'primary'" [class.btn--success]="b.style === 'success'"
              [class.btn--ghost]="b.style === 'plain'" [disabled]="busy()" (click)="move(b.action)">
              @if (b.action === 'confirm') { <app-icon name="check" /> }<span>{{ b.action === 'cancelled' ? 'Cancelar pedido' : b.label }}</span>
            </button>
          }
        </div>
      }
    </header>
    <div class="page-body">
      @if (missing()) {
        <div class="card">
          <p class="empty-state"><app-icon name="package" />Ese pedido ya no existe o no lo puedes ver.<a class="link" routerLink="/orders">Volver a Pedidos</a></p>
        </div>
      } @else if (order(); as o) {
        <div class="layout">
          <div class="col">
            <section class="card pane">
              <h2>Lo que pidió</h2>
              <ul class="lines">
                @for (line of o.lines; track $index) {
                  <li><span>{{ lineText(line) }}</span><span>{{ usd(lineCents(line)) }}</span></li>
                }
                <li class="muted">
                  @if (o.fulfillment === 'pickup') {
                    <span>Retira en la tienda</span><span>—</span>
                  } @else {
                    <span>Delivery{{ o.zone ? ' · ' + o.zone : '' }}</span><span>{{ o.deliveryCents === null ? 'Por confirmar' : usd(o.deliveryCents) }}</span>
                  }
                </li>
                <li class="total"><span>Total</span><span>{{ usd(total()) }}@if (totalBs(); as bs) { <small>{{ bs }}</small> }</span></li>
              </ul>
              @if (o.fulfillment === 'delivery' && o.deliveryCents === null) {
                <p class="form-alert warn"><app-icon name="alert" />El costo del delivery no está en el total: confírmalo con el cliente.</p>
              }
            </section>
            <section class="card pane">
              <h2>Cliente</h2>
              <dl class="facts">
                <dt>A nombre de</dt><dd>{{ o.customerName }}</dd>
                @if (o.contactName && o.contactName !== o.customerName) { <dt>En WhatsApp</dt><dd>{{ o.contactName }}</dd> }
                @if (o.address) { <dt>Dirección</dt><dd>{{ o.address }}</dd> }
                <dt>Método de pago</dt><dd>{{ o.paymentMethod?.name ?? 'Sin método' }}</dd>
                <dt>Recibido</dt><dd>{{ stamp(o.createdAt) }}</dd>
                @if (o.confirmedAt) { <dt>Pago confirmado</dt><dd>{{ stamp(o.confirmedAt) }}{{ o.confirmedBy ? ' por ' + o.confirmedBy : '' }}</dd> }
                @if (o.notes) { <dt>Notas</dt><dd>{{ o.notes }}</dd> }
              </dl>
            </section>
          </div>
          <div class="col">
            <section class="card pane">
              <h2>Revisión del pago</h2>
              @if (warnings().length) {
                <ul class="alerts" role="alert">
                  @for (w of warnings(); track w) { <li><app-icon name="alert" />{{ w }}</li> }
                </ul>
              }
              @if (receipts().length) {
                @for (r of receipts(); track r.mediaId) {
                  <figure>
                    @if (!r.url) {
                      <span class="sk picture" aria-label="Cargando el comprobante"></span>
                    } @else if (r.isImage) {
                      <a [href]="r.url" target="_blank" rel="noopener" aria-label="Abrir el comprobante en grande"><img [src]="r.url" alt="Comprobante de pago enviado por el cliente" /></a>
                    } @else {
                      <a class="btn" [href]="r.url" target="_blank" rel="noopener" [attr.download]="r.isPdf ? null : 'comprobante'">
                        <app-icon name="clip" /><span>{{ r.isPdf ? 'Abrir el PDF' : 'Descargar el archivo' }}</span>
                      </a>
                    }
                    <figcaption>Enviado el {{ stamp(r.createdAt) }}</figcaption>
                  </figure>
                }
              } @else {
                <p class="no-receipt"><app-icon name="clip" />{{ noReceiptText() }}</p>
              }
              @if (o.status !== 'cancelled') { <app-order-payment-check [order]="o" (saved)="load()" /> }
            </section>
            <section class="card pane"><app-order-sale-receipt [order]="o" (sent)="load()" /></section>
          </div>
        </div>
      } @else if (loadError(); as error) {
        <div class="form-alert" role="alert">
          <app-icon name="alert" /><span class="grow">{{ error }}</span>
          <button type="button" class="btn btn--sm" (click)="load()"><span>Reintentar</span></button>
        </div>
      } @else {
        <app-skeleton kind="detail" [rows]="5" />
      }
    </div>
  `,
  styleUrls: ['../../shared/ui/section.scss'],
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .title { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .crumbs { display: flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--color-text-muted); --icon-size: 14px; }
    .crumbs a:hover { color: var(--color-primary-text); }
    .crumbs span { color: var(--color-text); font-weight: 500; }
    h1 { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .head-actions { margin-left: auto; display: flex; gap: 10px; flex-wrap: wrap; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 18px; align-items: start; }
    @media (max-width: 1000px) { .layout { grid-template-columns: minmax(0, 1fr); } }
    .col { display: flex; flex-direction: column; gap: 18px; }
    .pane { padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; }
    .pane h2 { font-size: 16px; font-weight: 600; }
    .lines { list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: 14px; color: var(--color-text-2); }
    .lines li { display: flex; justify-content: space-between; gap: 12px; }
    .lines .muted { color: var(--color-text-muted); }
    .lines .total { border-top: 1px solid var(--color-border); padding-top: 10px; font-weight: 700; font-size: 15px; color: var(--color-text); }
    .total small { display: block; text-align: right; font-weight: 400; color: var(--color-text-muted); font-size: 12.5px; }
    figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
    img { display: block; max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 10px; border: 1px solid var(--color-border);
      background: var(--color-surface-muted); }
    figcaption { font-size: 12.5px; color: var(--color-text-muted); }
    .picture { height: 220px; border-radius: 10px; }
    figure .btn { align-self: flex-start; }
    .no-receipt { display: flex; gap: 10px; align-items: flex-start; padding: 14px; border-radius: 10px; border: 1px dashed var(--color-border-strong);
      color: var(--color-text-muted); font-size: 13.5px; line-height: 1.45; --icon-size: 17px; }
    .alerts { list-style: none; margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--color-warning-soft);
      border: 1px solid color-mix(in srgb, var(--color-warning) 35%, transparent); color: var(--color-warning-text); font-size: 13.5px;
      display: flex; flex-direction: column; gap: 6px; }
    .alerts li { display: flex; gap: 8px; align-items: flex-start; --icon-size: 16px; }
    .empty-state .link { margin-top: 4px; }
    .form-alert { align-items: center; }
    .grow { flex: 1; }
  `,
})
export class OrderDetailPage {
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(OrdersRemote) : null;
  private readonly session = inject(Session);
  private readonly actions = inject(OrderActions);
  private readonly orderId = inject(ActivatedRoute).snapshot.paramMap.get('orderId')!;

  protected readonly statusLabel = ORDER_STATUS_LABEL;
  protected readonly tone = ORDER_STATUS_TONE;
  protected readonly lineText = lineText;
  protected readonly lineCents = lineCents;
  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly missing = signal(false);
  /** The first read failed (not a missing order): said with a retry instead of loading forever. */
  protected readonly loadError = signal<string | null>(null);
  protected readonly buttons = computed(() => {
    const order = this.order();
    // The main action last, at the edge (mockup web-16): «Cancelar pedido», then «Confirmar» or «Completado».
    return order ? [...orderActions(order.status)].reverse() : [];
  });
  /** Its move is in progress: the buttons wait, so nothing is sent twice. */
  protected readonly busy = computed(() => {
    const order = this.order();
    return !!order && this.actions.running().has(order.id);
  });
  protected readonly total = computed(() => {
    const order = this.order();
    return order ? orderTotalCents(order) : 0;
  });
  protected readonly totalBs = computed(() => {
    const bs = toBs(this.total(), this.order()?.bsPerUsd ?? null);
    return bs === null ? null : formatVes(bs);
  });
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

  protected usd(cents: number): string {
    return formatUsdCents(cents);
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
      this.loadError.set(null);
      await Promise.all(order.receipts.filter((r) => !this.files()[r.mediaId]).map((r) => this.fetchFile(tenantId, r.mediaId)));
    } catch (error) {
      const failure = toApiFailure(error);
      if (failure.status === 404) this.missing.set(true);
      else if (!this.order()) this.loadError.set(failure.message);
    }
  }

  private async fetchFile(tenantId: Id, mediaId: Id): Promise<void> {
    if (!this.remote) return;
    try {
      const url = URL.createObjectURL(await this.remote.receipt(tenantId, this.orderId, mediaId));
      this.files.update((files) => ({ ...files, [mediaId]: url }));
    } catch {
      // The receipt keeps its placeholder; the next refresh tries again.
    }
  }
}
