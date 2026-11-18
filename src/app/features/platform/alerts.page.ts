import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_CONFIG } from '../../core/api/api-config';
import { Clock } from '../../core/clock';
import { TENANT_PLAN } from '../../shared/api/labels';
import { formatTime } from '../../shared/format/date-time';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { CATEGORY_LABEL, alertCopy, sinceText } from './alert-texts';
import { type AlertCategory, type AlertSeverity, type PlatformAlert, byCompany } from './platform-alerts';
import { PlatformData } from './platform.data';

type CategoryFilter = Exclude<AlertCategory, 'platform'> | 'all';

/**
 * Console → Alertas (mockup web-25): a summary, the platform's own problems apart, then each
 * company with its alerts together; every alert says what is happening, since when and what to do.
 */
@Component({
  selector: 'app-alerts-page',
  imports: [RouterLink, NgTemplateOutlet, Avatar, Icon, Skeleton],
  templateUrl: './alerts.page.html',
  styleUrls: ['./platform-pages.scss', './alerts.page.scss'],
})
export class AlertsPage {
  protected readonly data = inject(PlatformData);
  private readonly toaster = inject(Toaster);
  /** The preview's sample tables cannot be looked at again. */
  protected readonly live = inject(API_CONFIG).mode === 'api';

  /** Ticks every 30 s so «revisado hace…» and «desde hace…» stay true while the page is open. */
  private readonly clock = inject(Clock);
  private readonly now = signal(this.clock.now());
  protected readonly checking = signal(false);
  protected readonly severity = signal<AlertSeverity | 'all'>('all');
  protected readonly category = signal<CategoryFilter>('all');

  protected readonly severities: { id: AlertSeverity | 'all'; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'critical', label: 'Críticas' },
    { id: 'warning', label: 'Avisos' },
  ];
  protected readonly categories: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: 'Todo' },
    ...(Object.entries(CATEGORY_LABEL) as [Exclude<AlertCategory, 'platform'>, string][]).map(([id, label]) => ({ id, label })),
  ];

  private readonly all = computed(() => this.data.alerts());
  private readonly shown = computed(() =>
    this.all().filter(
      (a) =>
        (this.severity() === 'all' || a.severity === this.severity()) &&
        (this.category() === 'all' || a.category === this.category()),
    ),
  );
  protected readonly platform = computed(() => this.shown().filter((a) => !a.tenantId));
  protected readonly companies = computed(() => byCompany(this.shown()));

  protected readonly summary = computed(() => {
    const report = this.data.alertReport();
    const affected = new Set(this.all().flatMap((a) => (a.tenantId ? [a.tenantId] : []))).size;
    const total = report?.checked.companies ?? 0;
    return {
      critical: this.all().filter((a) => a.severity === 'critical').length,
      warning: this.all().filter((a) => a.severity === 'warning').length,
      affected,
      total,
      fine: Math.max(0, total - affected),
    };
  });

  protected readonly checkedText = computed(() => {
    const report = this.data.alertReport();
    if (!report) return '';
    const minutes = Math.max(0, Math.round((this.now().getTime() - new Date(report.checkedAt).getTime()) / 60_000));
    if (minutes < 1) return 'Revisado hace un momento';
    if (minutes < 60) return `Revisado hace ${minutes} min`;
    return `Revisado a las ${formatTime(report.checkedAt, 'America/Caracas')}`;
  });

  /** What «todo en orden» means, said plainly: what was looked at. */
  protected readonly checks = computed(() => {
    const checked = this.data.alertReport()?.checked;
    const numbers = checked?.numbers ?? 0;
    return [
      numbers === 1 ? 'El número está conectado' : `Los ${numbers} números están conectados`,
      'Ningún acceso de Meta vence esta semana',
      'Todos los mensajes de Meta se procesaron',
      'Ningún agente cerca de su límite del mes',
      'Los catálogos propios responden',
      'La tasa del BCV se leyó bien',
    ];
  });

  constructor() {
    void this.data.load();
    const timer = setInterval(() => this.now.set(this.clock.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected count(id: AlertSeverity | 'all'): number {
    return this.all().filter((a) => id === 'all' || a.severity === id).length;
  }

  protected copy(alert: PlatformAlert) {
    return alertCopy(alert);
  }

  protected since(alert: PlatformAlert): string {
    return sinceText(alert, this.now());
  }

  /** «Plan Equipo · 2 números», under each company's name. */
  protected companyLine(tenantId: string): string {
    const row = this.data.row(tenantId);
    if (!row) return '';
    const numbers = row.channels.length;
    return `Plan ${TENANT_PLAN[row.tenant.plan].text} · ${numbers} ${numbers === 1 ? 'número' : 'números'}`;
  }

  protected async checkNow(): Promise<void> {
    this.checking.set(true);
    const failure = await this.data.refreshAlerts();
    this.checking.set(false);
    this.now.set(this.clock.now());
    if (failure) this.toaster.show(failure, 'info');
  }
}
