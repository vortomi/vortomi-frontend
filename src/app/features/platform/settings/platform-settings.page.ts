import { Component } from '@angular/core';
import { EXCHANGE_RATE_CARD } from '../../exchange-rates/exchange-rate-card';
import { ExchangeRateSettings } from '../../settings/exchange-rate-settings';
import { PlatformExchangeRates } from './platform-exchange-rates';

/**
 * Console → Ajustes (mockup web-36): how Vortomi works as a business. For now one tab, «Tasa de
 * cambio», the same screen a company has, on Vortomi's own rate.
 */
@Component({
  selector: 'app-platform-settings-page',
  imports: [ExchangeRateSettings],
  providers: [{ provide: EXCHANGE_RATE_CARD, useExisting: PlatformExchangeRates }],
  template: `
    <header class="page-top">
      <h1>Ajustes</h1>
      <span class="sub">Cómo funciona Vortomi como negocio</span>
    </header>
    <nav class="tabs-line tabs" role="tablist" aria-label="Secciones de ajustes">
      <button type="button" role="tab" class="on" aria-selected="true">Tasa de cambio</button>
    </nav>
    <div class="page-body"><app-exchange-rate-settings /></div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .tabs { padding: 0 16px; background: var(--color-surface); flex-shrink: 0; }
  `,
})
export class PlatformSettingsPage {}
