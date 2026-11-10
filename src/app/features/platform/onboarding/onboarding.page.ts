import { Component, computed, inject, input, untracked, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../shared/ui/icon';
import { Skeleton } from '../../../shared/ui/skeleton';
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
  protected readonly steps = STEPS;

  /** ?resume=<tenantId> reopens a company left half way. */
  readonly resume = input<string>();

  protected readonly subtitle = computed(() => {
    const name = this.state.tenant()?.name;
    return name ? `${name} · alta manual` : 'Alta manual: la hacemos nosotros junto al cliente';
  });

  constructor() {
    effect(() => {
      const tenantId = this.resume();
      untracked(() => (tenantId ? this.state.resume(tenantId) : this.state.start()));
    });
  }

  protected stateOf(index: number): string {
    const current = this.state.invitationToken() ? STEPS.length : this.state.step();
    return index < current ? 'done' : index === current ? 'on' : 'todo';
  }
}
