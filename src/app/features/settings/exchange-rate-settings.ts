import { Component, computed, inject, signal } from '@angular/core';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import type { RateSource } from '../../shared/api/models';
import { calendarDay, formatShortDate, formatTime } from '../../shared/format/date-time';
import { Confirm } from '../../shared/ui/confirm';
import { DatePicker } from '../../shared/ui/date-picker';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';
import { Switch } from '../../shared/ui/switch';
import { Toaster } from '../../shared/ui/toaster';
import { ExchangeRates } from '../exchange-rates/exchange-rates.data';
import { formatIsoDay, formatRate, normalizeRate, weekdayOf } from '../exchange-rates/rate-format';

/** What the card is saving: a source, the system switch, a BCV read or a new rate. */
type PendingAction = RateSource | 'system' | 'refresh' | 'rate';

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
  imports: [Icon, Pill, Switch, DatePicker],
  templateUrl: './exchange-rate-settings.html',
  styleUrls: ['../../shared/ui/section.scss', './exchange-rate-settings.scss'],
})
export class ExchangeRateSettings {
  protected readonly rates = inject(ExchangeRates);
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(Confirm);

  /** Which action is being saved, so only its own control shows the circle. */
  protected readonly pending = signal<PendingAction | null>(null);

  protected readonly sources = SOURCES;
  protected readonly formatRate = formatRate;
  protected readonly formatIsoDay = formatIsoDay;
  protected readonly weekdayOf = weekdayOf;

  protected readonly today = computed(() => calendarDay(this.clock.now().toISOString(), this.session.timezone()));
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

  /** "27 oct 2026, 09:17", on the company's clock. */
  protected stamp(iso: string): string {
    const timezone = this.session.timezone();
    return `${formatShortDate(iso, timezone)}, ${formatTime(iso, timezone)}`;
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** Changes the bolívar prices every customer sees: ask first. */
  protected async choose(source: RateSource): Promise<void> {
    if (source === this.source() || this.pending()) return;
    const yes = await this.confirm.ask({
      title: source === 'bcv' ? '¿Usar la tasa del BCV?' : '¿Usar una tasa personalizada?',
      message:
        source === 'bcv'
          ? 'Los precios en bolívares que ven tus clientes pasan a calcularse con la tasa oficial del BCV, que se actualiza sola.'
          : 'Los precios en bolívares siguen con la tasa actual hasta que registres una tuya. Desde entonces la tasa del BCV ya no se aplica sola.',
      confirmLabel: source === 'bcv' ? 'Usar la tasa del BCV' : 'Usar tasa personalizada',
    });
    if (yes) await this.track(source, () => this.rates.setSource(source));
  }

  /** Which rate the customer prices use: theirs or the one configured here. Ask first. */
  protected async useSystemRate(on: boolean): Promise<void> {
    if (this.pending()) return;
    const yes = await this.confirm.ask({
      title: on ? '¿Usar la tasa de tu sistema?' : '¿Dejar de usar la tasa de tu sistema?',
      message: on
        ? 'Los precios en bolívares que ven tus clientes salen de tu propio sistema, igual que en la caja de tu tienda.'
        : 'Los precios en bolívares que ven tus clientes se calculan con la tasa que configures aquí y pueden no coincidir con los de tu caja.',
      confirmLabel: on ? 'Usar la de mi sistema' : 'Usar la de aquí',
    });
    if (yes) await this.track('system', () => this.rates.setUseSystemRate(on));
  }

  protected async refreshBcv(): Promise<void> {
    if (!this.pending()) await this.track('refresh', () => this.rates.refreshBcv());
  }

  private async track(action: PendingAction, work: () => Promise<boolean>): Promise<boolean> {
    this.pending.set(action);
    try {
      return await work();
    } finally {
      this.pending.set(null);
    }
  }

  protected async addRate(): Promise<void> {
    const rate = normalizeRate(this.rateDraft());
    if (rate === null) {
      this.toaster.show('Escribe la tasa en bolívares por dólar, por ejemplo 36,52.', 'info');
      return;
    }
    if (this.pending()) return;
    // A registered rate is never edited nor deleted, and customer prices change at once.
    const yes = await this.confirm.ask({
      title: `¿Registrar ${formatRate(rate)} Bs por dólar?`,
      message: `Vale desde el ${formatIsoDay(this.rateDate())} y los precios en bolívares la usan de inmediato. Queda en el historial: no se edita ni se borra.`,
      confirmLabel: 'Registrar tasa',
    });
    if (!yes) return;
    if (await this.track('rate', () => this.rates.addRate(rate, this.rateDate()))) this.rateDraft.set('');
  }
}
