import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '../../../core/api/api-client';
import { API_CONFIG } from '../../../core/api/api-config';
import { toApiFailure } from '../../../core/api/api-error';
import { Clock } from '../../../core/clock';
import { Session } from '../../../core/session';
import type { ApiExchangeRates } from '../../../shared/api/contract';
import type { ExchangeRateBook, RateSource } from '../../../shared/api/models';
import { Toaster } from '../../../shared/ui/toaster';
import type { ExchangeRateCard } from '../../exchange-rates/exchange-rate-card';
import type { ExchangeRateTexts } from '../../exchange-rates/exchange-rate-texts';

/** Vortomi's rate is shown and dated on Caracas' clock. */
const ZONE = 'America/Caracas';
const BOOK_ID = 'vortomi';

const TEXTS: ExchangeRateTexts = {
  lead: 'Convierte a bolívares lo que cada empresa paga de su plan. Cada pago guardará la tasa del día en que se hizo.',
  inUse: 'Las empresas pagan su plan en bolívares con esta tasa:',
  noRate: 'Aún no hay tasa: las empresas ven solo montos en USD.',
  keepsLast: 'Vortomi sigue con la última tasa.',
  toBcv: 'Los montos en bolívares de los planes pasan a la tasa oficial del BCV y se actualizan solos cada día.',
  toCustom: 'Los montos en bolívares de los planes usarán la tasa que registres aquí, hasta que la cambies.',
  refreshNow: 'Si el BCV ya publicó una tasa nueva para hoy, los montos en bolívares de los planes cambian en este momento.',
  registered: 'las empresas pagan su plan con ella.',
};

const EMPTY: ExchangeRateBook = {
  id: BOOK_ID,
  tenantId: BOOK_ID,
  rateSource: 'custom',
  bcv: { bsPerUsd: null, effectiveDate: null, checkedAt: null, error: null },
  exchangeRates: [],
  system: null,
};

/**
 * Vortomi's own exchange rate for the console (Ajustes → Tasa de cambio, mockup web-36), against
 * /platform/exchange-rates: the same card as a company's, so the same screen shows it. In the
 * preview without a server ('mock' mode, never deployed) it lives in memory.
 */
@Injectable({ providedIn: 'root' })
export class PlatformExchangeRates implements ExchangeRateCard {
  private readonly api = inject(ApiClient);
  private readonly clock = inject(Clock);
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);
  private readonly live = inject(API_CONFIG).mode === 'api';

  readonly book = signal<ExchangeRateBook | null>(this.live ? null : EMPTY);
  readonly busy = signal(false);
  readonly loaded = signal(!this.live);
  readonly loadError = signal<string | null>(null);
  readonly texts = TEXTS;
  readonly timezone = () => ZONE;

  constructor() {
    if (this.live) void this.reload();
  }

  async reload(): Promise<void> {
    if (!this.live) return;
    this.loadError.set(null);
    try {
      this.book.set(toBook(await this.api.get<ApiExchangeRates>('platform/exchange-rates')));
      this.loaded.set(true);
    } catch (error) {
      this.loadError.set(toApiFailure(error).message);
    }
  }

  setSource(source: RateSource): Promise<boolean> {
    const message = source === 'bcv' ? 'Vortomi usa la tasa del BCV y se actualiza sola.' : 'Vortomi usa la tasa que registres aquí.';
    return this.run(() => this.api.put('platform/exchange-rates/source', { rateSource: source }), message, (book) => ({ ...book, rateSource: source }));
  }

  /** Vortomi has no catalog system of its own: nothing to switch. */
  async setUseSystemRate(): Promise<boolean> {
    return false;
  }

  addRate(bsPerUsd: string, effectiveDate: string): Promise<boolean> {
    return this.run(
      () => this.api.post('platform/exchange-rates', { bsPerUsd, effectiveDate }),
      'Tasa registrada. Los montos en bolívares de los planes ya la usan.',
      (book) => {
        const previous = book.exchangeRates[0]?.bsPerUsd ?? null;
        const row = { bsPerUsd, effectiveDate, previousBsPerUsd: previous, changedBy: this.session.user()?.name ?? null, createdAt: this.clock.now().toISOString(), source: 'manual' as const };
        return { ...book, exchangeRates: [row, ...book.exchangeRates].slice(0, 20) };
      },
    );
  }

  refreshBcv(): Promise<boolean> {
    return this.run(() => this.api.post('platform/exchange-rates/bcv'), 'Tasa del BCV consultada.', (book) => book);
  }

  /** One action at a time. 'api': the server's card replaces ours; 'mock': `local` computes it. */
  private async run(send: () => Promise<ApiExchangeRates>, success: string, local: (book: ExchangeRateBook) => ExchangeRateBook): Promise<boolean> {
    const book = this.book();
    if (!book || this.busy()) return false;
    this.busy.set(true);
    try {
      this.book.set(this.live ? toBook(await send()) : local(book));
      this.toaster.show(success);
      return true;
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}

function toBook(row: ApiExchangeRates): ExchangeRateBook {
  return { id: BOOK_ID, tenantId: BOOK_ID, ...row };
}
