import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { TenantPlan } from '../../../shared/api/models';
import { TENANT_PLAN } from '../../../shared/api/labels';
import { formatShortDate } from '../../../shared/format/date-time';
import { formatUsdCents } from '../../../shared/format/money';
import { Avatar } from '../../../shared/ui/avatar';
import { Confirm } from '../../../shared/ui/confirm';
import { Dialog } from '../../../shared/ui/dialog';
import { Icon } from '../../../shared/ui/icon';
import { type OptionCard, OptionCards } from '../../../shared/ui/option-cards';
import { Pill } from '../../../shared/ui/pill';
import { Toaster } from '../../../shared/ui/toaster';
import type { Day, Subscription } from './subscription.models';
import { GRACE_OPTIONS, PAYMENT_METHOD_LABEL, addDays, billingStatus, fitsPlan, monthOf, monthTitle, statusLabel } from './subscription.rules';
import { SubscriptionsStore } from './subscriptions.store';

/**
 * One company's billing (mockup web-32, step 6): its status, payment history and plan, with
 * «Cambiar de plan» and «Dar días de gracia». The console never records payments. Sample data, kept in memory.
 */
@Component({
  selector: 'app-subscription-detail-page',
  imports: [RouterLink, Avatar, Dialog, Icon, OptionCards, Pill],
  templateUrl: './subscription-detail.page.html',
  styleUrls: ['../platform-pages.scss', './subscription-detail.page.scss'],
})
export class SubscriptionDetailPage {
  protected readonly store = inject(SubscriptionsStore);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  /** Bound from the route (withComponentInputBinding). */
  readonly subscriptionId = input.required<string>();

  protected readonly today = signal(this.store.today());
  protected readonly changingPlan = signal(false);
  protected readonly givingGrace = signal(false);
  protected readonly newPlan = signal<TenantPlan | null>(null);
  protected readonly graceDays = signal<string>(String(GRACE_OPTIONS[1]));
  protected readonly planText = TENANT_PLAN;
  protected readonly methodText = PAYMENT_METHOD_LABEL;
  protected readonly monthTitle = monthTitle;
  protected readonly monthOf = monthOf;

  protected readonly sub = computed(() => this.store.byId().get(this.subscriptionId()) ?? null);
  protected readonly status = computed(() => {
    const sub = this.sub();
    return sub ? billingStatus(sub, this.today()) : null;
  });
  protected readonly label = computed(() => {
    const sub = this.sub();
    return sub ? statusLabel(sub, this.today()) : null;
  });
  protected readonly terms = computed(() => {
    const sub = this.sub();
    return sub ? this.store.terms(sub.plan) : null;
  });

  /**
   * The paid plans other than the current one, in sight (a dropdown would be cut by the dialog).
   * One the company would not fit in says so.
   */
  protected readonly planOptions = computed<OptionCard[]>(() => {
    const sub = this.sub();
    if (!sub) return [];
    return this.store
      .plans()
      .filter((p) => p.plan !== 'internal' && p.plan !== sub.plan)
      .map((p) => ({
        value: p.plan,
        label: `${TENANT_PLAN[p.plan].text} · ${formatUsdCents(p.priceCents)} al mes`,
        icon: 'layers',
        hint: fitsPlan(sub, p)
          ? `${p.numbers} ${p.numbers === 1 ? 'número' : 'números'} · ${p.users} usuarios`
          : `No le alcanza: usa ${sub.usersUsed} usuarios y ${sub.numbersUsed} ${sub.numbersUsed === 1 ? 'número' : 'números'}`,
      }));
  });
  /** «7 días · hasta el 27 nov 2026». */
  protected readonly graceOptions = computed<OptionCard[]>(() =>
    GRACE_OPTIONS.map((d) => ({ value: String(d), label: `${d} días`, icon: 'calendar', hint: `Hasta el ${this.date(addDays(this.today(), d))}` })),
  );

  /** The status said in a full sentence, above the two boxes. */
  protected readonly notice = computed(() => {
    const sub = this.sub();
    const status = this.status();
    if (!sub || !status) return null;
    const month = monthTitle(monthOf(sub.nextChargeOn)).toLowerCase();
    const fee = formatUsdCents(this.store.terms(sub.plan).priceCents);
    switch (status) {
      case 'overdue':
        return { tone: 'error', text: `Debe ${month} (${fee}), que vencía el ${this.date(sub.nextChargeOn)}. Su panel sigue funcionando.` };
      case 'grace':
        return { tone: 'warn', text: `Debe ${month} (${fee}). Tiene días de gracia hasta el ${this.date(sub.graceUntil!)}.` };
      case 'due_soon':
        return { tone: 'warn', text: `Su cuota de ${month} (${fee}) vence el ${this.date(sub.nextChargeOn)}.` };
      case 'trial':
        return { tone: 'info', text: `Prueba gratis hasta el ${this.date(sub.trialEndsOn!)}. Desde ahí paga ${fee} al mes.` };
      default:
        return null;
    }
  });

  protected date(day: Day): string {
    return formatShortDate(`${day}T12:00:00Z`, 'UTC');
  }

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected usage(used: number, limit: number | null): string {
    return limit === null ? String(used) : `${used} de ${limit}`;
  }

  protected openPlanChange(): void {
    this.newPlan.set(null);
    this.changingPlan.set(true);
  }

  protected pickPlan(value: string): void {
    this.newPlan.set(value === 'basic' || value === 'team' ? value : null);
  }

  protected async changePlan(sub: Subscription): Promise<void> {
    const plan = this.newPlan();
    if (!plan) return;
    const terms = this.store.terms(plan);
    if (!fitsPlan(sub, terms)) {
      this.toaster.show(`${sub.companyName} usa más de lo que permite el plan ${TENANT_PLAN[plan].text}. Primero tiene que quitar usuarios o números.`, 'info');
      return;
    }
    this.changingPlan.set(false);
    const yes = await this.confirm.ask({
      title: `¿Pasar a ${sub.companyName} al plan ${TENANT_PLAN[plan].text}?`,
      message: `Desde su próximo cobro (${this.date(sub.nextChargeOn)}) pagará ${formatUsdCents(terms.priceCents)} al mes. El mes que ya corre no cambia.`,
      confirmLabel: 'Sí, cambiar de plan',
    });
    if (!yes) return;
    this.store.changePlan(sub.id, plan);
    this.toaster.show(`${sub.companyName} pasa al plan ${TENANT_PLAN[plan].text}. Es de ejemplo: se borra al recargar.`);
  }

  protected async giveGrace(sub: Subscription): Promise<void> {
    const days = Number(this.graceDays());
    this.givingGrace.set(false);
    const yes = await this.confirm.ask({
      title: `¿Dar ${days} días de gracia a ${sub.companyName}?`,
      message: 'Mientras duren, no aparece como atrasada. La deuda no cambia: sigue debiendo el mismo mes.',
      confirmLabel: 'Sí, dar días de gracia',
    });
    if (!yes) return;
    this.store.giveGrace(sub.id, days);
    this.toaster.show(`${sub.companyName} tiene ${days} días de gracia. Es de ejemplo: se borra al recargar.`);
  }
}
