import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BRAND } from '../../core/brand';
import { BusinessTypes } from '../../core/business-types';
import { Session } from '../../core/session';
import type { SellMethod, Sells } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { OptionCards } from '../../shared/ui/option-cards';
import { Toaster } from '../../shared/ui/toaster';
import { SetupData } from './setup.data';
import { planLines } from './setup-plan';
import { METHOD_OPTIONS, type PlanPart, SELLS_OPTIONS, type SetupAnswers, type SetupPlan } from './setup.models';


/**
 * The welcome (block C): three closed questions, then «Esto es lo que vamos a preparar» with a
 * checkbox per part. Opens by itself once for a company's admins; Ajustes can open it again.
 * Nothing the company already has is touched.
 */
@Component({
  selector: 'app-welcome-page',
  imports: [Icon, OptionCards],
  templateUrl: './welcome.page.html',
  styleUrl: './welcome.page.scss',
})
export class WelcomePage {
  protected readonly brand = BRAND;
  protected readonly session = inject(Session);
  protected readonly businessTypes = inject(BusinessTypes);
  private readonly setup = inject(SetupData);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly sellsOptions = SELLS_OPTIONS;
  protected readonly methodOptions = METHOD_OPTIONS;

  /** 0 what, 1 business type, 2 how, 3 the plan. */
  protected readonly step = signal(0);
  protected readonly answers = signal<SetupAnswers>({
    businessType: this.setup.status()?.businessType ?? '',
    businessTypeOther: this.setup.status()?.businessTypeOther ?? '',
    sells: this.setup.status()?.sells ?? 'products',
    sellMethod: this.setup.status()?.sellMethod ?? 'unit',
  });
  protected readonly error = signal<string | null>(null);
  protected readonly plan = signal<SetupPlan | null>(null);
  protected readonly kept = signal<ReadonlySet<PlanPart>>(new Set());
  protected readonly busy = signal(false);

  /** Only attending customers: how it sells does not matter, so that question is not asked. */
  private readonly solo = computed(() => this.answers().sells === 'none');
  protected readonly steps = computed(() => (this.solo() ? [0, 1, 3] : [0, 1, 2, 3]));
  protected readonly position = computed(() => this.steps().indexOf(this.step()));
  protected readonly lines = computed(() => (this.plan() ? planLines(this.plan()!) : []));
  protected readonly businessLabel = computed(() => this.businessTypes.labelOf(this.answers().businessType, this.answers().businessTypeOther));

  protected patch(change: Partial<SetupAnswers>): void {
    this.answers.update((a) => ({ ...a, ...change }));
    this.error.set(null);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async next(): Promise<void> {
    const a = this.answers();
    if (this.step() === 1 && !a.businessType) return this.error.set('Elige tu rubro para seguir.');
    if (this.step() === 1 && a.businessType === 'other' && a.businessTypeOther.trim().length < 3) return this.error.set('Escribe tu rubro para seguir.');
    const steps = this.steps();
    const following = steps[steps.indexOf(this.step()) + 1] ?? 3;
    if (following === 3 && !(await this.loadPlan())) return;
    this.step.set(following);
  }

  protected back(): void {
    const steps = this.steps();
    this.step.set(steps[Math.max(0, steps.indexOf(this.step()) - 1)] ?? 0);
  }

  protected toggle(part: PlanPart): void {
    this.kept.update((set) => {
      const next = new Set(set);
      if (next.has(part)) next.delete(part);
      else next.add(part);
      return next;
    });
  }

  protected async apply(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    const ok = await this.setup.apply(this.request(), [...this.kept()]);
    this.busy.set(false);
    if (!ok) return;
    this.toaster.show('Tu panel está listo');
    // A full load, so every screen reads what was just prepared.
    window.location.assign('/inbox');
  }

  protected async later(): Promise<void> {
    if (await this.setup.skip()) {
      this.toaster.show('Puedes hacerlo cuando quieras desde Ajustes → Empresa.', 'info');
      await this.router.navigateByUrl('/inbox');
    }
  }

  private request(): SetupAnswers {
    const a = this.answers();
    return { ...a, businessTypeOther: a.businessType === 'other' ? a.businessTypeOther.trim() : '', sellMethod: this.solo() ? 'unit' : a.sellMethod };
  }

  private async loadPlan(): Promise<boolean> {
    this.busy.set(true);
    const plan = await this.setup.plan(this.request());
    this.busy.set(false);
    if (!plan) return false;
    this.plan.set(plan);
    // Everything that adds something starts checked; the person unchecks what they do not want.
    this.kept.set(new Set(planLines(plan).filter((l) => l.adds).map((l) => l.part)));
    return true;
  }

  protected setSells(value: string): void {
    this.patch({ sells: value as Sells });
  }

  protected setMethod(value: string): void {
    this.patch({ sellMethod: value as SellMethod });
  }
}
