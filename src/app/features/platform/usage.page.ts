import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { META_RATES_USD } from '../../shared/billing/meta-pricing';
import { formatCount, formatUnitPrice, formatUsdCents } from '../../shared/format/money';
import { PlatformData } from './platform.data';

/**
 * Meta consumption per company this month. The original document asks to measure it from day one,
 * even before charging anyone. Amounts are estimates from the price table.
 */
@Component({
  selector: 'app-usage-page',
  imports: [RouterLink],
  template: `
    <header class="page-top">
      <h1>Uso y salud</h1>
      <span class="sub">Mensajes de {{ month }} por empresa. Cada número tiene 1.000 respuestas gratis al mes; lo demás lo paga la empresa a Meta.</span>
    </header>
    <div class="page-body">
      <div class="card table-card">
        <table class="data-table">
          <thead><tr><th>Empresa</th><th>Mensajes totales</th><th>Respuestas usadas de las gratis</th><th></th><th>Estimado a Meta</th></tr></thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr>
                <td><a class="link" [routerLink]="['/platform/tenants', row.id]">{{ row.name }}</a></td>
                <td>{{ row.total }}</td>
                <td>{{ row.service }} de {{ row.free }}</td>
                <td class="bar-cell"><div class="track"><i [style.width.%]="row.percent" [class.over]="row.over"></i></div></td>
                <td [class.over-text]="row.over">{{ row.cost }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="field-hint foot">Estimado con {{ rates.service }} por respuesta o plantilla de utilidad y {{ rates.marketing }} por plantilla de marketing (tarifa de Venezuela). El monto real lo informa Meta días después.</p>
    </div>
  `,
  styleUrl: './platform-pages.scss',
  styles: `
    .bar-cell { width: 180px; }
    .track { height: 7px; background: #eef0f3; border-radius: 99px; overflow: hidden; }
    .track i { display: block; height: 100%; background: var(--color-success); }
    .track i.over { background: var(--color-warning); }
    .over-text { color: #c2410c; font-weight: 600; }
    .foot { margin-top: 10px; }
  `,
})
export class UsagePage {
  private readonly data = inject(PlatformData);
  protected readonly month = new Intl.DateTimeFormat('es-VE', { month: 'long', timeZone: 'America/Caracas' }).format(new Date());

  constructor() {
    void this.data.load();
  }

  protected readonly rates = { service: formatUnitPrice(META_RATES_USD.service), marketing: formatUnitPrice(META_RATES_USD.marketing) };

  protected readonly rows = computed(() =>
    this.data
      .rows()
      .filter((r) => r.usage)
      .map(({ tenant, usage }) => {
        const u = usage!;
        return {
          id: tenant.id,
          name: tenant.name,
          total: formatCount(u.totalMessages),
          service: formatCount(u.service.sent),
          free: formatCount(u.service.free),
          percent: Math.min(100, Math.round((u.service.sent / u.service.free) * 100)),
          over: u.overFreeChannelIds.length > 0,
          cost: formatUsdCents(u.totalCents),
          sortKey: u.totalCents,
        };
      })
      .sort((a, b) => b.sortKey - a.sortKey),
  );
}
