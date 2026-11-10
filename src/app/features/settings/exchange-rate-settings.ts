import { Component, computed, inject, signal } from '@angular/core';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { RateSource } from '../../shared/api/models';
import { calendarDay, formatShortDate, formatTime } from '../../shared/format/date-time';
import { Confirm } from '../../shared/ui/confirm';
import { DatePicker } from '../../shared/ui/date-picker';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Skeleton } from '../../shared/ui/skeleton';
import { Switch } from '../../shared/ui/switch';
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
  imports: [DatePicker, Icon, Pill, Skeleton, Switch],
  templateUrl: './exchange-rate-settings.html',
  styleUrls: ['../../shared/ui/section.scss', './exchange-rate-settings.scss'],
})
export class ExchangeRateSettings {
  protected readonly rates = inject(ExchangeRates);
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(Confirm);

  protected readonly sources = SOURCES;
  protected readonly formatRate = formatRate;
  protected readonly formatIsoDay = formatIsoDay;
  protected readonly weekdayOf = weekdayOf;

  private readonly today = computed(() => calendarDay(this.clock.now().toISOString(), this.session.timezone()));
  protected readonly source = computed(() => this.rates.book()?.rateSource ?? 'custom');
  protected readonly bcv = computed(() => this.rates.book()?.bcv ?? null);
  protected readonly history = computed(() => this.rates.book()?.exchangeRates ?? []);
  protected readonly current = computed(() => this.history()[0] ?? null);
  /** Only for a company with its own catalog system: its rate and whether prices use it. */
  protected readonly system = computed(() => this.rates.book()?.system ?? null);
  /** "Tasa de tu sistema, del 28 oct 2026, 19:10." */
  protected readonly systemOrigin = computed(() => {
    const date = this.system()?.rateDate;
    return date ? `Tasa de tu sistema, del ${this.stamp(date)}.` : 'Tasa de tu sistema.';
  });
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
  /** Which action is being saved, so only its button shows the loading circle. */
  protected readonly working = signal<'source' | 'system' | 'bcv' | 'rate' | null>(null);
  protected readonly todayIso = computed(() => this.today());

  /** "27 oct 2026, 09:17", on the company's clock. */
  protected stamp(iso: string): string {
    const timezone = this.session.timezone();
    return `${formatShortDate(iso, timezone)}, ${formatTime(iso, timezone)}`;
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** Changes the prices every customer sees in bolívares: asked first. */
  protected async choose(source: RateSource): Promise<void> {
    if (source === this.source() || this.rates.busy()) return;
    const yes = await this.confirm.ask(
      source === 'bcv'
        ? { title: '¿Usar la tasa del BCV?', message: 'Los precios en bolívares pasan a la tasa oficial del BCV y se actualizan solos cada día.', confirmLabel: 'Usar la tasa del BCV' }
        : { title: '¿Usar una tasa personalizada?', message: 'Los precios en bolívares usarán la tasa que registres aquí, hasta que la cambies.', confirmLabel: 'Usar tasa personalizada' },
    );
    if (yes) await this.during('source', () => this.rates.setSource(source));
  }

  protected async setUseSystemRate(use: boolean): Promise<void> {
    if (this.rates.busy()) return;
    const yes = await this.confirm.ask(
      use
        ? { title: '¿Usar la tasa de tu sistema?', message: 'Los precios en bolívares saldrán de tu propio sistema, igual que en la caja de tu tienda.', confirmLabel: 'Usar la de mi sistema' }
        : { title: '¿Dejar de usar la tasa de tu sistema?', message: 'Los precios en bolívares se calcularán con la tasa configurada aquí y pueden no coincidir con los de tu caja.', confirmLabel: 'Usar la de aquí' },
    );
    if (yes) await this.during('system', () => this.rates.setUseSystemRate(use));
  }

  protected async refreshBcv(): Promise<void> {
    if (this.rates.busy()) return;
    const yes = await this.confirm.ask({
      title: '¿Consultar el BCV ahora?',
      message: 'Si el BCV ya publicó una tasa nueva para hoy, tus precios en bolívares cambian en este momento.',
      confirmLabel: 'Consultar ahora',
    });
    if (yes) await this.during('bcv', () => this.rates.refreshBcv());
  }

  protected async addRate(): Promise<void> {
    const rate = normalizeRate(this.rateDraft());
    if (rate === null) {
      this.toaster.show('Escribe la tasa en bolívares por dólar, por ejemplo 36,52.', 'info');
      return;
    }
    if (this.rates.busy()) return;
    const yes = await this.confirm.ask({
      title: `¿Registrar ${formatRate(rate)} Bs por dólar?`,
      message: `Vale desde el ${formatIsoDay(this.rateDate())}. Una tasa registrada no se edita ni se borra, y tus clientes ven los precios con ella.`,
      confirmLabel: 'Registrar tasa',
    });
    if (yes && (await this.during('rate', () => this.rates.addRate(rate, this.rateDate())))) this.rateDraft.set('');
  }

  protected retry(): void {
    void this.rates.reload();
  }

  private async during(action: 'source' | 'system' | 'bcv' | 'rate', work: () => Promise<boolean>): Promise<boolean> {
    this.working.set(action);
    try {
      return await work();
    } finally {
      this.working.set(null);
    }
  }
}
