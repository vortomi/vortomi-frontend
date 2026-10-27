import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { ApiExchangeRates } from '../../shared/api/contract';
import type { ExchangeRateBook, Id, RateSource } from '../../shared/api/models';

/** The exchange rate card against vortomi-backend ('api' mode). Every answer is the whole card. */
@Injectable({ providedIn: 'root' })
export class ExchangeRatesRemote {
  private readonly api = inject(ApiClient);

  async get(tenantId: Id): Promise<ExchangeRateBook> {
    return toBook(tenantId, await this.api.get<ApiExchangeRates>(this.path(tenantId)));
  }

  /** Switching to the BCV reads it before answering. */
  async setSource(tenantId: Id, rateSource: RateSource): Promise<ExchangeRateBook> {
    return toBook(tenantId, await this.api.put<ApiExchangeRates>(this.path(tenantId, '/source'), { rateSource }));
  }

  async addRate(tenantId: Id, bsPerUsd: string, effectiveDate: string): Promise<ExchangeRateBook> {
    return toBook(tenantId, await this.api.post<ApiExchangeRates>(this.path(tenantId), { bsPerUsd, effectiveDate }));
  }

  async refreshBcv(tenantId: Id): Promise<ExchangeRateBook> {
    return toBook(tenantId, await this.api.post<ApiExchangeRates>(this.path(tenantId, '/bcv')));
  }

  private path(tenantId: Id, rest = ''): string {
    return this.api.company(tenantId, `exchange-rates${rest}`);
  }
}

function toBook(tenantId: Id, row: ApiExchangeRates): ExchangeRateBook {
  return { id: tenantId, tenantId, ...row };
}
