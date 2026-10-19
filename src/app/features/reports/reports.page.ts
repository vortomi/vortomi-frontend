import { Component, computed, inject, signal } from '@angular/core';
import { Clock } from '../../core/clock';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import type { Id } from '../../shared/api/models';
import { estimateSpend } from '../../shared/billing/meta-pricing';
import { toCsv } from '../../shared/files/csv';
import { downloadText } from '../../shared/files/download';
import { calendarDay, formatMonthName } from '../../shared/format/date-time';
import { formatDuration } from '../../shared/format/duration';
import { formatCount, formatUsdCents } from '../../shared/format/money';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { InboxData } from '../inbox/inbox.data';
import { waitingMs } from '../pipeline/pipeline.rules';
import { DailyChart } from './daily-chart';
import { MetaSpendCard } from './meta-spend-card';
import { NumberHealth } from './number-health';
import { ReportsData } from './reports.data';
import {
  type ReportPeriod,
  type Totals,
  byDay,
  byPerson,
  comparisonRange,
  inRange,
  onTimeRate,
  percentChange,
  periodRange,
  summarize,
} from './reports.rules';

const LONG_WAIT_MS = 2 * 3_600_000;

interface AgentRow {
  id: Id | null;
  name: string;
  totals: Totals;
  rate: number;
}

/** How the team answers and what WhatsApp costs this month (mockup web-5). Admins only. */
@Component({
  selector: 'app-reports-page',
  imports: [Avatar, Icon, DailyChart, MetaSpendCard, NumberHealth],
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
})
export class ReportsPage {
  protected readonly data = inject(ReportsData);
  protected readonly workspace = inject(Workspace);
  private readonly inbox = inject(InboxData);
  private readonly session = inject(Session);
  private readonly clock = inject(Clock);
  private readonly toaster = inject(Toaster);

  protected readonly period = signal<ReportPeriod>('month');

  private readonly today = computed(() => calendarDay(this.clock.now().toISOString(), this.session.timezone()));
  private readonly range = computed(() => periodRange(this.period(), this.today()));
  private readonly rows = computed(() => inRange(this.data.days(), this.range()));
  private readonly previous = computed(() => summarize(inRange(this.data.days(), comparisonRange(this.period(), this.today()))));

  protected readonly periods = computed(() => {
    const thisMonth = this.today().slice(0, 7);
    const lastMonth = periodRange('previousMonth', this.today()).from.slice(0, 7);
    return [
      { id: 'last7' as const, label: '7 días' },
      { id: 'month' as const, label: this.capitalize(formatMonthName(thisMonth)) },
      { id: 'previousMonth' as const, label: this.capitalize(formatMonthName(lastMonth)) },
    ];
  });

  protected readonly totals = computed(() => summarize(this.rows()));
  protected readonly onTimePercent = computed(() => onTimeRate(this.totals()));
  protected readonly averageTicketCents = computed(() => {
    const { wonCents, wonCount } = this.totals();
    return wonCount ? Math.round(wonCents / wonCount) : 0;
  });
  protected readonly bars = computed(() => byDay(this.rows(), this.range()));
  /** Sales only make sense for companies that use the pipeline. */
  protected readonly sells = this.workspace.sells;

  protected readonly conversationsChange = computed(() =>
    percentChange(this.totals().conversations, this.previous().conversations),
  );

  /** Minutes faster (negative) or slower (positive) than the period before. */
  protected readonly medianChange = computed(() => {
    const now = this.totals().medianSec;
    const before = this.previous().medianSec;
    return now === null || before === null || this.previous().conversations === 0 ? null : Math.round((now - before) / 60);
  });

  protected readonly comparedTo = computed(() => {
    switch (this.period()) {
      case 'last7':
        return 'los 7 días anteriores';
      case 'month':
        return `los mismos días de ${formatMonthName(periodRange('previousMonth', this.today()).from.slice(0, 7))}`;
      case 'previousMonth':
        return 'el mes anterior';
    }
  });

  protected readonly agents = computed<AgentRow[]>(() => {
    const groups = byPerson(this.rows());
    const users = this.workspace.userById();
    // Everyone active appears, even with zero, so an idle person is visible too.
    const ids = new Set<Id | null>([...this.workspace.activeTeam().map((m) => m.user.id), ...groups.keys()]);
    return [...ids]
      .map((id) => {
        const totals = groups.get(id) ?? summarize([]);
        const name = id === null ? 'Sin responder' : (users.get(id)?.name ?? 'Ya no está en el equipo');
        return { id, name, totals, rate: onTimeRate(totals) };
      })
      .sort((a, b) => Number(a.id === null) - Number(b.id === null) || b.totals.conversations - a.totals.conversations);
  });

  /** Live: open chats whose last message is the customer's. */
  protected readonly waiting = computed(() => {
    const now = this.clock.now();
    const waits = this.inbox
      .items()
      .map(({ conversation }) => waitingMs(conversation, this.inbox.lastMessageByConversation().get(conversation.id), now))
      .filter((ms): ms is number => ms !== null);
    return { count: waits.length, long: waits.filter((ms) => ms >= LONG_WAIT_MS).length };
  });

  protected readonly spend = computed(() => estimateSpend(this.workspace.usage()));
  protected readonly spendMonth = computed(() => formatMonthName(this.workspace.usage()[0]?.month ?? this.today().slice(0, 7)));

  protected count(value: number): string {
    return formatCount(value);
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected duration(seconds: number | null): string {
    return seconds === null ? '—' : formatDuration(seconds * 1000);
  }

  protected exportCsv(): void {
    const { from, to } = this.range();
    const csv = toCsv(
      ['Persona', 'Atendidas', 'Primera respuesta (min)', 'A tiempo (%)', 'Ventas', 'Ventas (USD)'],
      this.agents().map(({ name, totals, rate }) => [
        name,
        String(totals.conversations),
        totals.medianSec === null ? '' : String(Math.round(totals.medianSec / 60)),
        String(rate),
        String(totals.wonCount),
        (totals.wonCents / 100).toFixed(2).replace('.', ','),
      ]),
    );
    downloadText(`reporte-${this.session.tenant()?.slug ?? 'empresa'}-${from}-a-${to}.csv`, csv);
    this.toaster.show('Reporte exportado');
  }

  private capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
