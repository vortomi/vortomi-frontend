import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Confirm } from '../../../shared/ui/confirm';
import { Icon } from '../../../shared/ui/icon';
import { Skeleton } from '../../../shared/ui/skeleton';
import { Toaster } from '../../../shared/ui/toaster';
import { failIf } from '../fail-if';
import { PlatformData } from '../platform.data';
import { OnboardingState } from './onboarding.state';
import { StepActivate } from './step-activate';
import { StepChannel } from './step-channel';
import { StepCompany } from './step-company';
import { StepTest } from './step-test';

const STEPS = [
  ['Empresa y administrador', 'Datos básicos'],
  ['Conectar WhatsApp', 'Acceso a su cuenta de Meta'],
  ['Prueba', 'Un mensaje de ida y vuelta'],
  ['Activar', 'Invitación y alta'],
] as const;

/** Manual sign-up of a company, phases 0 and 1 (mockups web-9 to web-12). */
@Component({
  selector: 'app-onboarding-page',
  imports: [RouterLink, Icon, Skeleton, StepCompany, StepChannel, StepTest, StepActivate],
  template: `
    <header class="page-top">
      <h1>Nueva empresa</h1>
      <span class="sub">{{ subtitle() }}</span>
      <span class="spacer"></span>
      @if (discardable()) {
        <button type="button" class="btn btn--danger" [disabled]="discarding()" (click)="discard()"><app-icon name="trash" /><span>Descartar borrador</span></button>
      }
      <a class="btn" routerLink="/platform/tenants"><app-icon name="x" /><span>Salir</span></a>
    </header>
    <ol class="steps" aria-label="Pasos del alta">
      @for (step of steps; track $index) {
        @if ($index) {
          <li class="ln" [class.done]="$index <= state.step()" aria-hidden="true"></li>
        }
        <li class="stp" [class]="stateOf($index)" [attr.aria-current]="$index === state.step() ? 'step' : null">
          <span class="c">
            @if (stateOf($index) === 'done') {
              <app-icon name="check" [stroke]="3" />
            } @else {
              {{ $index + 1 }}
            }
          </span>
          <span><b>{{ step[0] }}</b><small>{{ step[1] }}</small></span>
        </li>
      }
    </ol>
    @if (state.resuming()) {
      <div class="page-body"><div class="card resume"><app-skeleton kind="form" [rows]="5" /></div></div>
    } @else {
      @switch (state.step()) {
        @case (0) { <app-step-company /> }
        @case (1) { <app-step-channel /> }
        @case (2) { <app-step-test /> }
        @default { <app-step-activate /> }
      }
    }
  `,
  styleUrl: './onboarding.page.scss',
})
export class OnboardingPage {
  protected readonly state = inject(OnboardingState);
  private readonly data = inject(PlatformData);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly steps = STEPS;

  /** ?resume=<tenantId> reopens a company left half way. */
  readonly resume = input<string>();

  protected readonly subtitle = computed(() => {
    const name = this.state.tenant()?.name;
    return name ? `${name} · alta manual` : 'Alta manual: la hacemos nosotros junto al cliente';
  });

  /** A saved company with no number yet: a repeated or abandoned attempt can be thrown away. */
  protected readonly discardable = computed(() => !!this.state.tenantId() && !this.state.connected() && !this.state.invitationToken() && !this.state.resuming());
  protected readonly discarding = signal(false);

  constructor() {
    effect(() => {
      const tenantId = this.resume();
      untracked(() => {
        // The address already names the company on screen (it was just saved): nothing to reload.
        if (tenantId && tenantId === this.state.tenantId()) return;
        if (tenantId) this.state.resume(tenantId);
        else this.state.start();
      });
    });
    // Once step 1 is saved, the address names the company, so reloading the page resumes it instead of starting over.
    effect(() => {
      const tenantId = this.state.tenantId();
      if (!tenantId || tenantId === untracked(this.resume)) return;
      void this.router.navigate([], { relativeTo: this.route, queryParams: { resume: tenantId }, replaceUrl: true });
    });
  }

  protected async discard(): Promise<void> {
    const tenantId = this.state.tenantId();
    if (!tenantId || this.discarding()) return;
    this.discarding.set(true);
    const done = await this.confirm.ask({
      title: `¿Descartar el borrador de ${this.state.company().name || 'esta empresa'}?`,
      message: 'Se borra esta alta a medias. Todavía no tiene número, personas ni invitaciones, así que no se pierde nada más. No se puede deshacer.',
      confirmLabel: 'Descartar',
      danger: true,
      action: async () => failIf(await this.data.discardDraft(tenantId)),
    });
    this.discarding.set(false);
    if (!done) return;
    this.state.start();
    this.toaster.show('Borrador descartado', 'info');
    void this.router.navigateByUrl('/platform/tenants');
  }

  protected stateOf(index: number): string {
    const current = this.state.invitationToken() ? STEPS.length : this.state.step();
    return index < current ? 'done' : index === current ? 'on' : 'todo';
  }
}
