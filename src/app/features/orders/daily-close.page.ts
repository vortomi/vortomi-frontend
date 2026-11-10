import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { CloseGroup, DailyClose, PaymentCurrency } from '../../shared/api/models';
import { formatTime } from '../../shared/format/date-time';
import { formatAmount, formatUsdCents } from '../../shared/format/money';
import { DatePicker } from '../../shared/ui/date-picker';
import { Icon } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { OrdersRemote } from './orders-remote';

/**
 * «Cierre del día»: the orders whose payment was confirmed that day (on the company clock), added up
 * by payment method, with what should have arrived next to what the team wrote down. A cancelled
 * order drops out. Each person sees the orders of the conversations they see; admins, all of them.
 */
@Component({
  selector: 'app-daily-close-page',
  imports: [DatePicker, Icon, RouterLink, Skeleton],
  template: `
    <header class="page-top">
      <div class="title">
        <nav class="crumbs" aria-label="Ruta"><a routerLink="/orders">Pedidos</a><app-icon name="chev-right" /><span>Cierre del día</span></nav>
        <h1>Cierre del día</h1>
      </div>
      <app-date-picker class="day" label="Día del cierre" [value]="day()" [max]="today()" [todayIso]="today()" (picked)="pick($event)" />
    </header>
    <div class="page-body">
      @if (!remote) {
        <div class="card"><p class="empty-state"><app-icon name="calendar" />El cierre se ve con el servidor.</p></div>
      } @else if (close(); as c) {
        @if (!c.count) {
          <div class="card"><p class="empty-state"><app-icon name="calendar" />Ningún pago confirmado este día.</p></div>
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
      } @else if (loadError(); as error) {
        <div class="form-alert" role="alert">
          <app-icon name="alert" /><span class="grow">{{ error }}</span>
          <button type="button" class="btn btn--sm" (click)="retry()"><span>Reintentar</span></button>
        </div>
      } @else {
        <div class="totals"><div class="card stat"><span class="sk" style="width: 50%"></span><span class="sk big"></span></div><div class="card stat"><span class="sk" style="width: 40%"></span><span class="sk big"></span></div></div>
        <h2>Por método de pago</h2>
        <div class="card table-card"><app-skeleton kind="table" [rows]="3" [cols]="5" /></div>
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .title { display: flex; flex-direction: column; gap: 4px; }
    .crumbs { display: flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--color-text-muted); --icon-size: 14px; }
    .crumbs a:hover { color: var(--color-primary-text); }
    .crumbs span { color: var(--color-text); font-weight: 500; }
    .day { margin-left: auto; width: 280px; }
    h2 { font-size: 16px; font-weight: 600; margin: 24px 0 12px; }
    .totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
    .stat { padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; }
    .stat > span:not(.sk) { font-size: 13px; color: var(--color-text-muted); }
    .stat b { font-size: 22px; font-weight: 700; }
    .stat .big { height: 22px; width: 35%; }
    .table-card { overflow-x: auto; }
    td small { display: block; font-size: 12.5px; color: var(--color-text-muted); }
    td.warn { color: var(--color-danger); font-weight: 600; }
    .form-alert { align-items: center; }
    .grow { flex: 1; }
  `,
})
export class DailyClosePage {
  protected readonly remote = inject(API_CONFIG).mode === 'api' ? inject(OrdersRemote) : null;
  private readonly session = inject(Session);

  /** Today on the company clock, "2026-11-10". */
  protected readonly today = computed(() => new Intl.DateTimeFormat('en-CA', { timeZone: this.session.timezone() }).format(new Date()));
  protected readonly day = signal(this.today());
  protected readonly close = signal<DailyClose | null>(null);
  /** The day could not be read: said with a retry instead of loading forever. */
  protected readonly loadError = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected pick(value: string | null): void {
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

  protected retry(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    this.close.set(null);
    this.loadError.set(null);
    try {
      this.close.set(await this.remote.dailyClose(tenantId, this.day()));
    } catch (error) {
      this.loadError.set(toApiFailure(error).message);
    }
  }
}
