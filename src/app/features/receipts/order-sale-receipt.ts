import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { Id, OrderDetail, ReceiptMode } from '../../shared/api/models';
import { formatShortDate, formatTime } from '../../shared/format/date-time';
import { Icon } from '../../shared/ui/icon';
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
  imports: [Icon],
  template: `
    <h2>Recibo de compra</h2>
    @let o = order();
    @if (o.saleReceipt; as r) {
      @if (url(); as src) {
        <a [href]="src" target="_blank" rel="noopener" title="Abrir en grande"><img [src]="src" alt="Recibo de compra enviado al cliente" /></a>
      } @else {
        <div class="placeholder">Cargando…</div>
      }
      <p class="hint">{{ r.code ? 'Recibo ' + r.code : 'Recibo subido por tu equipo' }} · enviado al cliente el {{ stamp(r.createdAt) }}</p>
    } @else if (mode() === 'off') {
      <p class="hint">Tu empresa no envía recibos. Puedes cambiarlo en Ajustes → Recibo.</p>
    } @else if (o.status === 'cancelled') {
      <p class="hint">El pedido se canceló: no lleva recibo.</p>
    } @else if (o.status !== 'done') {
      <p class="hint">{{ mode() === 'own' ? 'Cuando completes el pedido, aquí subes la imagen del recibo y se la enviamos al cliente.' : 'Cuando completes el pedido, tu cliente recibe su recibo por WhatsApp.' }}</p>
    } @else if (mode() === 'own') {
      <label class="btn btn--primary upload" [class.disabled]="uploading()">
        @if (uploading()) { <span class="spinner" aria-hidden="true"></span> } @else { <app-icon name="image" /> }
        Subir recibo
        <input type="file" accept="image/png,image/jpeg" hidden [disabled]="uploading()" (change)="upload($event)" />
      </label>
      <p class="hint">Imagen PNG o JPG de hasta 5 MB. Se la enviamos al cliente por WhatsApp.</p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; }
    h2 { margin: 0; }
    img { display: block; max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 10px; border: 1px solid var(--color-border); }
    .placeholder { height: 160px; border-radius: 10px; background: var(--color-surface-muted); display: flex; align-items: center; justify-content: center;
      color: var(--color-text-muted); font-size: 13px; }
    .hint { font-size: 12.5px; color: var(--color-text-muted); margin: 0; }
    .upload { align-self: flex-start; cursor: pointer; }
    .disabled { opacity: 0.6; pointer-events: none; }
  `,
})
export class OrderSaleReceipt {
  private readonly remote = inject(ReceiptRemote);
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);

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

  protected async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const tenantId = this.session.tenant()?.id;
    if (!file || !tenantId) return;
    const picture = await readPicture(file, MAX_OWN_RECEIPT_BYTES);
    if (!picture) return this.toaster.show('El recibo debe ser una imagen PNG o JPG de hasta 5 MB.', 'info');
    this.uploading.set(true);
    try {
      await this.remote.uploadOwn(tenantId, this.order().id, picture);
      this.toaster.show('Recibo enviado al cliente');
      this.sent.emit();
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
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
