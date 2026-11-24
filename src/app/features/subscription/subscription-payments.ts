import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';

/**
 * Suscripción → Pagos (mockup web-35, step 4). Companies report their payments from stage 3
 * (documentations/18); until then there are none to list, and the screen says what will come.
 */
@Component({
  selector: 'app-subscription-payments',
  imports: [Icon, Pill],
  template: `
    <div class="card"><p class="empty-state"><app-icon name="dollar" />Todavía no tienes pagos.</p></div>
    <p class="note">Cuando reportes tus pagos desde aquí, los verás con su estado: <app-pill tone="blue" [dot]="true">En revisión</app-pill>,
      <app-pill tone="green" [dot]="true">Aprobado</app-pill> o <app-pill tone="red" [dot]="true">Rechazado</app-pill>, con el motivo.</p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .note { font-size: 13px; color: var(--color-text-muted); line-height: 1.7; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionPayments {}
