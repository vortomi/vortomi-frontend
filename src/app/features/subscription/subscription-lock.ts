import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatUsdCents } from '../../shared/format/money';
import { Icon } from '../../shared/ui/icon';
import { SubscriptionData } from './subscription.data';
import { dayText } from './subscription.rules';

/**
 * Every panel screen but Suscripción while the company is suspended for not paying (mockup
 * web-37, frame 6): what happened, what is kept, and the way out. Agents cannot pay: they are told
 * to ask the owner or an admin.
 */
@Component({
  selector: 'app-subscription-lock',
  imports: [Icon, RouterLink],
  template: `
    <div class="wrap">
      <section class="lock" role="alert">
        <span class="mark"><app-icon name="lock" /></span>
        <h2>Tu cuenta está suspendida</h2>
        @if (data.subscription(); as s) {
          <p>Tu plan venció el {{ date(s.nextDueOn) }} y no recibimos el pago. Debes {{ money(s.owedCents) }}.</p>
        } @else {
          <p>La cuenta de tu empresa está suspendida por falta de pago.</p>
        }
        <ul>
          <li>Los mensajes de tus clientes <b>se siguen guardando</b>.</li>
          <li>El bot <b>no responde</b> mientras tanto.</li>
          <li>Al pagar, todo vuelve a funcionar solo.</li>
        </ul>
        @if (admin()) {
          <a class="btn btn--primary" routerLink="/subscription">Ir a Suscripción</a>
        } @else {
          <p class="ask">Pide al dueño o a un administrador que pague desde Suscripción.</p>
        }
      </section>
    </div>
  `,
  styles: `
    :host { display: block; flex: 1; min-height: 0; overflow: auto; }
    .wrap { min-height: 100%; display: grid; place-items: center; padding: 32px 16px; }
    .lock { max-width: 420px; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 26px; text-align: center;
      background: var(--color-surface); border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent); border-radius: var(--radius-lg); }
    .mark { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--color-danger-soft); color: var(--color-danger-text); --icon-size: 22px; }
    h2 { font-size: 18px; font-weight: 700; }
    p { font-size: 13.5px; color: var(--color-text-2); line-height: 1.5; }
    ul { text-align: left; font-size: 13.5px; color: var(--color-text-2); line-height: 1.6; padding-left: 18px; }
    .btn { margin-top: 6px; }
    .ask { font-weight: 600; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionLock {
  /** Owner or admin: they can pay. */
  readonly admin = input(false);
  protected readonly data = inject(SubscriptionData);

  protected money(cents: number): string {
    return formatUsdCents(cents);
  }

  protected date(day: string): string {
    return dayText(day);
  }
}
