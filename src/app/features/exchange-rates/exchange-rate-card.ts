import { InjectionToken, type Signal, inject } from '@angular/core';
import type { ExchangeRateBook, RateSource } from '../../shared/api/models';
import type { ExchangeRateTexts } from './exchange-rate-texts';
import { ExchangeRates } from './exchange-rates.data';

/**
 * What «Tasa de cambio» reads and changes. The panel's is the signed-in company's (ExchangeRates,
 * the default); the console provides Vortomi's own (console → Ajustes). Same screen for both.
 */
export interface ExchangeRateCard {
  readonly book: Signal<ExchangeRateBook | null>;
  readonly busy: Signal<boolean>;
  readonly loaded: Signal<boolean>;
  readonly loadError: Signal<string | null>;
  readonly texts: ExchangeRateTexts;
  /** The clock the dates are shown on. */
  timezone(): string;
  setSource(source: RateSource): Promise<boolean>;
  setUseSystemRate(useSystemRate: boolean): Promise<boolean>;
  addRate(bsPerUsd: string, effectiveDate: string): Promise<boolean>;
  refreshBcv(): Promise<boolean>;
  reload(): Promise<void>;
}

/** The company's own card unless a parent provides another (the console provides Vortomi's). */
export const EXCHANGE_RATE_CARD = new InjectionToken<ExchangeRateCard>('ExchangeRateCard', {
  providedIn: 'root',
  factory: () => inject(ExchangeRates),
});
