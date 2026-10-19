import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { META_RATES_USD, type MetaSpend } from '../../shared/billing/meta-pricing';
import { formatCount, formatUnitPrice, formatUsdCents } from '../../shared/format/money';

/** What Meta will charge the company this month, by kind of message (mockup web-5). */
@Component({
  selector: 'app-meta-spend-card',
  template: `
    <header>
      <h2>Gasto en WhatsApp · {{ month() }}</h2>
      <span class="muted">lo cobra Meta a la empresa</span>
    </header>
    @for (row of rows(); track row.title) {
      <div class="row">
        <div><b>{{ row.title }}</b><span>{{ row.detail }}</span></div>
        <strong>{{ row.amount }}</strong>
      </div>
    }
    <div class="row total">
      <b>Total estimado</b>
      <strong>{{ money(spend().totalCents) }}</strong>
    </div>
    <p class="field-hint">Tarifas de referencia para números de Venezuela. El monto real lo informa Meta días después.</p>
  `,
  styles: `
    :host { display: block; }
    header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 10px; padding: 18px 22px 8px; }
    h2 { font-size: 16px; }
    header .muted { font-size: 12.5px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 22px;
      border-top: 1px solid var(--color-border-soft); }
    .row b { display: block; font-weight: 500; font-size: 14px; }
    .row span { display: block; font-size: 12.5px; color: var(--color-text-muted); margin-top: 2px; }
    .row strong { font-size: 14px; white-space: nowrap; }
    .total { background: var(--color-surface-muted); }
    .total b { font-weight: 700; }
    .field-hint { padding: 10px 22px 16px; margin: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetaSpendCard {
  readonly spend = input.required<MetaSpend>();
  readonly month = input.required<string>();

  protected readonly rows = computed(() => {
    const { service, utility, marketing, freeEntry, numbers } = this.spend();
    const perNumber = numbers === 1 ? '1.000 gratis' : `${formatCount(service.free)} gratis (1.000 por número)`;
    return [
      {
        title: 'Respuestas a clientes',
        detail: service.billable
          ? `${formatCount(service.sent)} enviadas · ${formatCount(service.billable)} pasaron de las gratis`
          : `${formatCount(service.sent)} de ${perNumber} este mes`,
        amount: this.money(service.cents),
      },
      {
        title: 'Plantillas de utilidad',
        detail: utility.sent ? `${formatCount(utility.sent)} envíos × ~${formatUnitPrice(META_RATES_USD.utility)}` : 'No se usaron',
        amount: this.money(utility.cents),
      },
      {
        title: 'Plantillas de marketing',
        detail: marketing.sent ? `${formatCount(marketing.sent)} envíos × ~${formatUnitPrice(META_RATES_USD.marketing)}` : 'No se usaron',
        amount: this.money(marketing.cents),
      },
      {
        title: 'Desde anuncios de Facebook e Instagram',
        detail: freeEntry.sent ? `${formatCount(freeEntry.sent)} mensajes, gratis 72 h` : 'Sin conversaciones desde anuncios',
        amount: this.money(0),
      },
    ];
  });

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }
}
