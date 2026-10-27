import { Component, computed, inject, signal } from '@angular/core';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { RateSource } from '../../shared/api/models';
import { calendarDay, formatShortDate, formatTime } from '../../shared/format/date-time';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Toaster } from '../../shared/ui/toaster';
import { ExchangeRates } from '../exchange-rates/exchange-rates.data';
import { formatIsoDay, formatRate, normalizeRate, weekdayOf } from '../exchange-rates/rate-format';

const SOURCES: { value: RateSource; label: string; detail: string }[] = [
  { value: 'bcv', label: 'Tasa BCV (automática)', detail: 'Se actualiza sola con la tasa oficial del Banco Central de Venezuela.' },
  { value: 'custom', label: 'Tasa personalizada', detail: 'La registras tú a mano, con la fecha desde la que vale.' },
];

/**
 * «Tasa de cambio» (as ochoa-parts doc 18): the rate comes from the BCV, read every hour and
 * applied on its fecha valor (one published for a later day shows as the «próxima tasa»), or
 * from an admin, who registers it by hand. Every rate stays in the history with its origin.
 * The browser computes no amounts: it only picks which sentence to show.
 */
@Component({
  selector: 'app-exchange-rate-settings',
  imports: [Icon, Pill],
  templateUrl: './exchange-rate-settings.html',
  styleUrls: ['../../shared/ui/section.scss', './exchange-rate-settings.scss'],
})
export class ExchangeRateSettings {
  protected readonly rates = inject(ExchangeRates);
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly toaster = inject(Toaster);

  protected readonly sources = SOURCES;
  protected readonly formatRate = formatRate;
  protected readonly formatIsoDay = formatIsoDay;
  protected readonly weekdayOf = weekdayOf;

  private readonly today = computed(() => calendarDay(this.clock.now().toISOString(), this.session.timezone()));
  protected readonly source = computed(() => this.rates.book()?.rateSource ?? 'custom');
  protected readonly bcv = computed(() => this.rates.book()?.bcv ?? null);
  protected readonly history = computed(() => this.rates.book()?.exchangeRates ?? []);
  protected readonly current = computed(() => this.history()[0] ?? null);
  /** The BCV is chosen but the company still uses a rate typed by hand. */
  protected readonly pendingBcv = computed(() => this.source() === 'bcv' && this.current()?.source === 'manual');
  /**
   * «Próxima tasa»: what the BCV already published for a later day (it publishes the day before),
   * shown for information only; the company switches to it on its fecha valor.
   */
  protected readonly upcoming = computed(() => {
    const status = this.bcv();
    const current = this.current();
    if (this.source() !== 'bcv' || !status?.bsPerUsd || !status.effectiveDate || status.effectiveDate <= this.today()) return null;
    const changes = current?.source !== 'bcv' || Number(current.bsPerUsd) !== Number(status.bsPerUsd);
    return changes ? { bsPerUsd: status.bsPerUsd, effectiveDate: status.effectiveDate } : null;
  });

  protected readonly rateDraft = signal('');
  protected readonly rateDate = signal(this.today());

  /** "27 oct 2026, 09:17", on the company's clock. */
  protected stamp(iso: string): string {
    const timezone = this.session.timezone();
    return `${formatShortDate(iso, timezone)}, ${formatTime(iso, timezone)}`;
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async choose(source: RateSource): Promise<void> {
    if (source !== this.source()) await this.rates.setSource(source);
  }

  protected async addRate(): Promise<void> {
    const rate = normalizeRate(this.rateDraft());
    if (rate === null) {
      this.toaster.show('Escribe la tasa en bolívares por dólar, por ejemplo 36,52.', 'info');
      return;
    }
    if (await this.rates.addRate(rate, this.rateDate())) this.rateDraft.set('');
  }
}
