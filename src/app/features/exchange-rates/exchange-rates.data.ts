import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { ExchangeRate, ExchangeRateBook, Id, RateSource } from '../../shared/api/models';
import { editableTable } from '../../shared/api/editable-table';
import { calendarDay } from '../../shared/format/date-time';
import { Toaster } from '../../shared/ui/toaster';
import { ExchangeRatesRemote } from './exchange-rates-remote';

const EMPTY_BCV = { bsPerUsd: null, effectiveDate: null, checkedAt: null, error: null };

/**
 * The active company's exchange rate (ochoa-parts doc 18, made per company): its source, the BCV's
 * last read and its history. The rate in use is the newest row; prices in bolívares use it.
 * - 'mock': books from public/data, changes in memory; the BCV is not really read.
 * - 'api':  read from the server; each write answers with the whole card. One action at a time.
 */
@Injectable({ providedIn: 'root' })
export class ExchangeRates {
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly toaster = inject(Toaster);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(ExchangeRatesRemote) : null;
  private readonly table = editableTable<ExchangeRateBook>('exchange-rates');

  readonly busy = signal(false);
  readonly book = computed<ExchangeRateBook | null>(() => {
    const tenantId = this.session.tenant()?.id;
    if (!tenantId) return null;
    return this.table.rows().find((b) => b.tenantId === tenantId) ?? { id: tenantId, tenantId, rateSource: 'custom', bcv: EMPTY_BCV, exchangeRates: [] };
  });
  /** The rate in use, as a number for price conversions; null hides prices in bolívares. */
  readonly current = computed(() => {
    const latest = this.book()?.exchangeRates[0];
    return latest ? Number(latest.bsPerUsd) : null;
  });

  constructor() {
    if (!this.remote) return;
    effect(() => {
      const tenantId = this.session.tenant()?.id;
      if (tenantId) untracked(() => void this.load(tenantId));
    });
  }

  setSource(source: RateSource): Promise<boolean> {
    const message = source === 'bcv' ? 'La empresa usa la tasa del BCV y se actualiza sola.' : 'La empresa usa la tasa que registres aquí.';
    return this.run((remote, tenantId) => remote.setSource(tenantId, source), message, (book) => {
      const next = { ...book, rateSource: source };
      return source === 'bcv' ? this.applyBcv(next) : next;
    });
  }

  addRate(bsPerUsd: string, effectiveDate: string): Promise<boolean> {
    return this.run(
      (remote, tenantId) => remote.addRate(tenantId, bsPerUsd, effectiveDate),
      'Tasa registrada. Los precios en bolívares ya la usan.',
      (book) => this.prepend(book, { bsPerUsd, effectiveDate, changedBy: this.session.user()?.name ?? null, source: 'manual' }),
    );
  }

  refreshBcv(): Promise<boolean> {
    return this.run(
      (remote, tenantId) => remote.refreshBcv(tenantId),
      'Tasa del BCV consultada.',
      (book) => this.applyBcv({ ...book, bcv: { ...book.bcv, checkedAt: this.clock.now().toISOString() } }),
    );
  }

  private async load(tenantId: Id): Promise<void> {
    try {
      const book = await this.remote!.get(tenantId);
      this.table.replaceAll([...this.table.rows().filter((b) => b.tenantId !== tenantId), book]);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    }
  }

  /**
   * One action at a time for the whole card. 'api': the server's card replaces ours, or its
   * Spanish error shows; 'mock': `local` computes the new card. Resolves to whether it was saved.
   */
  private async run(
    send: (remote: ExchangeRatesRemote, tenantId: Id) => Promise<ExchangeRateBook>,
    success: string,
    local: (book: ExchangeRateBook) => ExchangeRateBook,
  ): Promise<boolean> {
    const book = this.book();
    if (!book || this.busy()) return false;
    this.busy.set(true);
    try {
      this.table.upsert(this.remote ? await send(this.remote, book.tenantId) : local(book));
      this.toaster.show(success);
      return true;
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /** Prototype only: the BCV's last read becomes the rate from its fecha valor, as the server does. */
  private applyBcv(book: ExchangeRateBook): ExchangeRateBook {
    const { bsPerUsd, effectiveDate } = book.bcv;
    const latest = book.exchangeRates[0];
    const today = calendarDay(this.clock.now().toISOString(), this.session.timezone());
    if (!bsPerUsd || !effectiveDate || effectiveDate > today) return book;
    if (latest?.source === 'bcv' && Number(latest.bsPerUsd) === Number(bsPerUsd)) return book;
    return this.prepend(book, { bsPerUsd, effectiveDate, changedBy: null, source: 'bcv' });
  }

  private prepend(book: ExchangeRateBook, rate: Omit<ExchangeRate, 'previousBsPerUsd' | 'createdAt'>): ExchangeRateBook {
    const previous = book.exchangeRates[0]?.bsPerUsd ?? null;
    const row: ExchangeRate = { ...rate, previousBsPerUsd: previous, createdAt: this.clock.now().toISOString() };
    return { ...book, exchangeRates: [row, ...book.exchangeRates].slice(0, 20) };
  }
}
