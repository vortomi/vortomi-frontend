import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Session } from '../../core/session';
import type { Id, OrderDetail, ReceiptMode } from '../../shared/api/models';
import { formatShortDate, formatTime } from '../../shared/format/date-time';
import { Confirm } from '../../shared/ui/confirm';
import { FileDrop } from '../../shared/ui/file-drop';
import { Toaster } from '../../shared/ui/toaster';
import { ReceiptRemote, readPicture } from './receipt-remote';

/** WhatsApp takes images up to 5 MB. */
const MAX_OWN_RECEIPT_BYTES = 5 * 1024 * 1024;

/**
 * The sale receipt of one order, on its page: the one it got (made by Vortomi or uploaded), or,
 * with «Lo subo yo», the button to upload it once the order is completed. What the company chose
 * comes from «Ajustes → Recibo».
 */
@Component({
  selector: 'app-order-sale-receipt',
  imports: [FileDrop],
  template: `
    <h2>Recibo de compra</h2>
    @let o = order();
    @if (o.saleReceipt; as r) {
      @if (url(); as src) {
        <a [href]="src" target="_blank" rel="noopener" aria-label="Abrir el recibo en grande"><img [src]="src" alt="Recibo de compra enviado al cliente" /></a>
      } @else {
        <span class="sk picture" aria-label="Cargando el recibo"></span>
      }
      <p class="hint">{{ r.code ? 'Recibo ' + r.code : 'Recibo subido por tu equipo' }} · enviado al cliente el {{ stamp(r.createdAt) }}</p>
    } @else if (mode() === 'off') {
      <p class="hint">Tu empresa no envía recibos. Puedes cambiarlo en Ajustes → Recibo.</p>
    } @else if (o.status === 'cancelled') {
      <p class="hint">El pedido se canceló: no lleva recibo.</p>
    } @else if (o.status !== 'done') {
      <p class="hint">{{ mode() === 'own' ? 'Cuando completes el pedido, aquí subes la imagen del recibo y se la enviamos al cliente.' : 'Cuando completes el pedido, tu cliente recibe su recibo por WhatsApp.' }}</p>
    } @else if (mode() === 'own') {
      <app-file-drop accept="image/png,image/jpeg" label="Subir el recibo" hint="Imagen PNG o JPG de hasta 5 MB. Se la enviamos al cliente por WhatsApp."
        [busy]="uploading()" (picked)="upload($event)" />
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; }
    h2 { margin: 0; font-size: 16px; font-weight: 600; }
    img { display: block; max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 10px; border: 1px solid var(--color-border); }
    .picture { height: 220px; border-radius: 10px; }
    .hint { font-size: 13px; color: var(--color-text-muted); margin: 0; }
  `,
})
export class OrderSaleReceipt {
  private readonly remote = inject(ReceiptRemote);
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(Confirm);

  readonly order = input.required<OrderDetail>();
  /** The receipt went out: the page reloads the order. */
  readonly sent = output<void>();

  protected readonly mode = signal<ReceiptMode>('vortomi');
  protected readonly uploading = signal(false);
  protected readonly url = signal<string | null>(null);
  private readonly hasReceipt = computed(() => !!this.order().saleReceipt);
  private fetchedFor: Id | null = null;

  constructor() {
    void this.loadMode();
    // Its picture, once per order, as soon as it has one.
    effect(() => {
      if (this.hasReceipt()) untracked(() => void this.loadPicture(this.order().id));
    });
    inject(DestroyRef).onDestroy(() => {
      const url = this.url();
      if (url) URL.revokeObjectURL(url);
    });
  }

  protected stamp(iso: string): string {
    const timezone = this.session.timezone();
    return `${formatShortDate(iso, timezone)}, ${formatTime(iso, timezone)}`;
  }

  /** It goes straight to the customer by WhatsApp, so it asks first; the dialog waits while it uploads. */
  protected async upload(file: File): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!tenantId || this.uploading()) return;
    const picture = await readPicture(file, MAX_OWN_RECEIPT_BYTES);
    if (!picture) return this.toaster.show('El recibo debe ser una imagen PNG o JPG de hasta 5 MB.', 'info');
    const order = this.order();
    this.uploading.set(true);
    try {
      const sent = await this.confirm.ask({
        title: `¿Enviar el recibo a ${order.customerName}?`,
        message: `Le enviamos «${file.name}» por WhatsApp como recibo del pedido ${order.code}. Un pedido lleva un solo recibo.`,
        confirmLabel: 'Enviar recibo',
        action: () => this.remote.uploadOwn(tenantId, order.id, picture),
      });
      if (!sent) return;
      this.toaster.show('Recibo enviado al cliente');
      this.sent.emit();
    } finally {
      this.uploading.set(false);
    }
  }

  private async loadMode(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!tenantId) return;
    try {
      this.mode.set((await this.remote.get(tenantId)).mode);
    } catch {
      // Secondary: without it, the page says what happens by default.
    }
  }

  private async loadPicture(orderId: Id): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!tenantId || this.fetchedFor === orderId) return;
    this.fetchedFor = orderId;
    try {
      this.url.set(URL.createObjectURL(await this.remote.file(tenantId, orderId)));
    } catch {
      this.fetchedFor = null;
    }
  }
}
