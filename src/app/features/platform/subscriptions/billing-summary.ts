import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../../core/clock';
import type { SubscriptionSummary, SummaryPeriod } from '../../../shared/api/subscriptions';
import { formatUsdCents, formatVes } from '../../../shared/format/money';
import { receiptCode } from '../../../shared/format/receipt-code';
import { Icon } from '../../../shared/ui/icon';
import { Skeleton } from '../../../shared/ui/skeleton';
import { Toaster } from '../../../shared/ui/toaster';
import { dayText } from './billing.rules';
import { IncomeChart } from './income-chart';
import { PlatformSubscriptions } from './platform-subscriptions';

const PERIODS: { id: SummaryPeriod; label: string }[] = [
  { id: 'month', label: 'Este mes' },
  { id: 'year', label: 'Este año' },
  { id: '12m', label: 'Últimos 12 meses' },
  { id: 'all', label: 'Todo' },
];

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Suscripciones → Resumen (mockup web-51): what came in (approved payments, for what really
 * arrived, on the day they were paid) this month and in the period, what comes in each month, what
 * is owed, how companies stand, the latest income, how they pay, and what falls due soon. The
 * period changes the income, the chart and «Por método».
 */
@Component({
  selector: 'app-billing-summary',
  imports: [Icon, IncomeChart, RouterLink, Skeleton],
  templateUrl: './billing-summary.html',
  styleUrl: './billing-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingSummary {
  private readonly subscriptions = inject(PlatformSubscriptions);
  private readonly toaster = inject(Toaster);
  private readonly today = new Date(inject(Clock).now().getTime() - 4 * 3_600_000).toISOString().slice(0, 10);

  /** «Ver todos los pagos»: the Pagos tab. */
  readonly payments = output<void>();

  protected readonly periods = PERIODS;
  protected readonly period = signal<SummaryPeriod>('year');
  protected readonly summary = signal<SubscriptionSummary | null>(null);
  protected readonly failed = signal(false);
  protected readonly downloading = signal(false);

  protected readonly monthName = MONTH_NAMES[Number(this.today.slice(5, 7)) - 1] ?? '';
  protected readonly current = computed(() => (this.period() === 'month' ? this.today : this.today.slice(0, 7)));

  /** «▲ 74 % frente a octubre»; «En octubre no hubo ingresos»; nothing when neither month had any. */
  protected readonly change = computed(() => {
    const s = this.summary();
    if (!s) return null;
    const { thisMonthCents: now, previousMonthCents: before } = s.income;
    const prevName = MONTH_NAMES[(Number(this.today.slice(5, 7)) + 10) % 12] ?? '';
    if (!before) return now ? { up: true, text: `En ${prevName} no hubo ingresos` } : null;
    const pct = Math.round(((now - before) / before) * 100);
    return { up: pct >= 0, text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)} % frente a ${prevName} (${formatUsdCents(before)})` };
  });

  protected readonly periodTitle = computed(() => {
    switch (this.period()) {
      case 'month':
        return `Ingresos de ${this.monthName}`;
      case 'year':
        return `Ingresos de ${this.today.slice(0, 4)}`;
      case '12m':
        return 'Ingresos de los últimos 12 meses';
      default:
        return 'Ingresos desde el primer pago';
    }
  });

  /** The widest method fills its bar; the others in proportion. */
  protected readonly methodMax = computed(() => Math.max(1, ...(this.summary()?.byMethod.map((m) => m.cents) ?? [])));

  constructor() {
    effect(() => {
      const period = this.period();
      untracked(() => void this.load(period));
    });
  }

  protected async load(period = this.period()): Promise<void> {
    this.failed.set(false);
    try {
      this.summary.set(await this.subscriptions.summary(period));
    } catch {
      this.failed.set(true);
    }
  }

  protected async download(): Promise<void> {
    this.downloading.set(true);
    try {
      const url = URL.createObjectURL(await this.subscriptions.incomeFile(this.period()));
      const link = document.createElement('a');
      link.href = url;
      link.download = `ingresos-vortomi-${this.period()}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      this.toaster.show('No pudimos descargar los ingresos.', 'info');
    } finally {
      this.downloading.set(false);
    }
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected bs(amount: string): string {
    return formatVes(Number(amount));
  }

  protected date(day: string, year = false): string {
    return dayText(day, year);
  }

  protected receipt(n: number): string {
    return receiptCode(n);
  }

  protected width(cents: number): number {
    return Math.max(2, Math.round((cents / this.methodMax()) * 100));
  }
}
