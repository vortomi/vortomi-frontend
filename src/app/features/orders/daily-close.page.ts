import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { CloseGroup, DailyClose, PaymentCurrency } from '../../shared/api/models';
import { formatTime } from '../../shared/format/date-time';
import { formatAmount, formatUsdCents } from '../../shared/format/money';
import { Toaster } from '../../shared/ui/toaster';
import { OrdersRemote } from './orders-remote';

/**
 * «Cierre del día»: the orders whose payment was confirmed that day (on the company clock), added up
 * by payment method, with what should have arrived next to what the team wrote down. A cancelled
 * order drops out. Each person sees the orders of the conversations they see; admins, all of them.
 */
@Component({
  selector: 'app-daily-close-page',
  imports: [RouterLink],
  template: `
    <header class="page-top">
      <nav class="crumbs"><a routerLink="/orders">Pedidos</a> / <span>Cierre del día</span></nav>
      <input class="input day" type="date" aria-label="Día del cierre" [max]="today()" [value]="day()" (change)="pick($event)" />
    </header>
    <div class="page-body">
      @if (!remote) {
        <p class="empty">El cierre se ve con el servidor.</p>
      } @else if (close(); as c) {
        @if (!c.count) {
          <p class="empty">Ningún pago confirmado este día.</p>
        } @else {
          <section class="totals">
            <div class="card stat"><span>Pedidos pagados</span><b>{{ c.count }}</b></div>
            <div class="card stat"><span>Vendido (en dólares)</span><b>{{ usd(c.totalCents) }}</b></div>
          </section>

          <h2>Por método de pago</h2>
          <div class="card table-card">
            <table class="data-table">
              <thead><tr><th>Método</th><th>Pedidos</th><th>Total del pedido</th><th>Debía llegar</th><th>Anotado como recibido</th></tr></thead>
              <tbody>
                @for (g of c.byMethod; track g.paymentMethod?.id ?? 'none') {
                  <tr>
                    <td>{{ g.paymentMethod?.name ?? 'Sin método' }}</td>
                    <td>{{ g.count }}</td>
                    <td>{{ usd(g.totalCents) }}</td>
                    <td>{{ amount(g.expectedAmount, g.currency) }}</td>
                    <td [class.warn]="isShort(g)">
                      {{ amount(g.receivedAmount, g.currency) }}
                      @if (g.withoutReceived) { <small>{{ g.withoutReceived }} sin anotar</small> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <h2>Pedidos</h2>
          <div class="card table-card">
            <table class="data-table">
              <thead><tr><th>Hora</th><th>Pedido</th><th>Cliente</th><th>Método</th><th>Referencia</th><th>Recibido</th><th>Confirmó</th></tr></thead>
              <tbody>
                @for (o of c.orders; track o.id) {
                  <tr class="clickable" [routerLink]="['/orders', o.id]">
                    <td>{{ o.confirmedAt ? time(o.confirmedAt) : '—' }}</td>
                    <td><b>{{ o.code }}</b></td>
                    <td>{{ o.customerName }}</td>
                    <td>{{ o.paymentMethod?.name ?? 'Sin método' }}</td>
                    <td>{{ o.paymentReference ?? '—' }}</td>
                    <td>{{ o.receivedAmount ? amount(o.receivedAmount, o.currency) : 'Sin anotar' }}</td>
                    <td>{{ o.confirmedBy ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else {
        <p class="empty">Cargando…</p>
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .crumbs { font-size: 13.5px; color: var(--color-text-muted); }
    .crumbs span { color: var(--color-text); font-weight: 500; }
    .day { margin-left: auto; width: auto; }
    h2 { font-size: 15px; margin: 22px 0 10px; }
    .totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
    .stat { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
    .stat span { font-size: 12.5px; color: var(--color-text-muted); }
    .stat b { font-size: 22px; }
    .table-card { overflow-x: auto; }
    td small { display: block; font-size: 12px; color: var(--color-text-muted); }
    td.warn { color: var(--color-warning); font-weight: 600; }
    .empty { color: var(--color-text-muted); font-size: 14px; }
  `,
})
export class DailyClosePage {
  protected readonly remote = inject(API_CONFIG).mode === 'api' ? inject(OrdersRemote) : null;
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);

  /** Today on the company clock, "2026-11-10". */
  protected readonly today = computed(() => new Intl.DateTimeFormat('en-CA', { timeZone: this.session.timezone() }).format(new Date()));
  protected readonly day = signal(this.today());
  protected readonly close = signal<DailyClose | null>(null);

  constructor() {
    void this.load();
  }

  protected pick(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value || value === this.day()) return;
    this.day.set(value);
    void this.load();
  }

  protected usd(cents: number): string {
    return formatUsdCents(cents);
  }

  protected amount(value: string, currency: PaymentCurrency): string {
    return formatAmount(Number(value), currency);
  }

  protected time(iso: string): string {
    return formatTime(iso, this.session.timezone());
  }

  /** Everything was written down, and less arrived than should have. */
  protected isShort(group: CloseGroup): boolean {
    const expected = Number(group.expectedAmount);
    return group.withoutReceived === 0 && expected > 0 && expected - Number(group.receivedAmount) > expected * 0.005;
  }

  private async load(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    this.close.set(null);
    try {
      this.close.set(await this.remote.dailyClose(tenantId, this.day()));
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    }
  }
}
