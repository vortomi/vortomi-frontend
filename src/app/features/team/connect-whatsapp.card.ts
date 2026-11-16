import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Session } from '../../core/session';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { WhatsappLogo } from '../../shared/ui/whatsapp-logo';
import { ChannelSignupActions, type ConnectResult, metaBillingUrl } from './channel-signup.actions';

type Connected = Extract<ConnectResult, { kind: 'connected' }>;

/**
 * «Conectar WhatsApp» in Canales y equipo (mockups web-18 and web-19): what to have at hand, the
 * button that opens Meta's window and, once connected, the last step: the owner's own card in Meta.
 * Vortomi never asks for or sees that card.
 */
@Component({
  selector: 'app-connect-whatsapp',
  imports: [Icon, WhatsappLogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (connected(); as done) {
      <section class="card pay" [class.wide]="!compact()">
        <div class="pay-head">
          <span class="ok"><app-icon name="check" /></span>
          <div><b>{{ done.result.displayNumber }} conectado</b><span>{{ done.result.coexistence ? 'Sigues usándolo en tu teléfono' : 'Número nuevo, solo en Vortomi' }}</span></div>
        </div>
        @if (!done.result.subscribed) {
          <div class="form-alert warn"><app-icon name="alert" />Meta no confirmó que nos enviará los mensajes de este número. Pulsa «Conectar WhatsApp» otra vez.</div>
        }
        @if (done.result.coexistence && done.result.syncRequested.length < 2) {
          <div class="form-alert warn"><app-icon name="alert" />No pudimos pedir tus chats y contactos del teléfono. Si conectas otra vez hoy, los traemos.</div>
        }
        <div class="form-alert warn">
          <app-icon name="alert" />
          <span><b>Último paso: agrega tu tarjeta en Meta.</b> Meta cobra directo a tu tarjeta los mensajes que envía el bot. Sin ella, el bot puede dejar de responder.</span>
        </div>
        <div class="form-alert info"><app-icon name="shield" /><span><b>Vortomi nunca te pedirá tu tarjeta</b>, ni aquí ni por WhatsApp. Solo se escribe en la página de Meta.</span></div>
        <div class="row">
          <a class="btn btn--primary" [href]="billingUrl()" target="_blank" rel="noopener noreferrer"><span>Agregar tarjeta en Meta ↗</span></a>
          <button type="button" class="btn btn--ghost" (click)="connected.set(null)"><span>Ya la agregué</span></button>
        </div>
        <p class="hint">Se abre business.facebook.com en una pestaña nueva. Al terminar, vuelve a esta.</p>
      </section>
    } @else if (signup.state() === 'unavailable') {
      <section class="add">
        <app-icon name="plus" />
        <b>{{ compact() ? '¿Otro número?' : 'Conecta tu número de WhatsApp' }}</b>
        <span>Por ahora lo conectamos nosotros contigo, en unos 30 minutos. Escríbenos a soporte y coordinamos.</span>
      </section>
    } @else if (compact()) {
      <section class="card more">
        <span class="wa"><app-whatsapp-logo /></span>
        <b>¿Otro número?</b>
        <p>Conéctalo tú mismo. Si es tu WhatsApp Business, lo sigues usando en tu teléfono.</p>
        <button type="button" class="btn btn--whatsapp" [disabled]="busy()" [attr.aria-busy]="busy()" (click)="connect()">
          <app-whatsapp-logo /><span>Conectar con WhatsApp</span>
        </button>
        <p class="secure"><app-icon name="lock" />Ventana segura de Meta (Facebook)</p>
      </section>
    } @else {
      <section class="card start wide">
        <span class="wa big"><app-whatsapp-logo /></span>
        <b>Conecta el WhatsApp de tu empresa</b>
        <p>El bot responde a tus clientes y tú sigues viendo todo en tu teléfono.</p>
        <ol>
          <li><i>1</i>Tu cuenta de Facebook (la personal sirve)</li>
          <li><i>2</i>Tu teléfono con WhatsApp Business a la mano</li>
          <li><i>3</i>Una tarjeta Visa o Mastercard para pagarle a Meta</li>
        </ol>
        <button type="button" class="btn btn--whatsapp btn--lg" [disabled]="busy()" [attr.aria-busy]="busy()" (click)="connect()">
          <app-whatsapp-logo /><span>Conectar con WhatsApp</span>
        </button>
        <p class="secure"><app-icon name="lock" />Se abre una ventana segura de Meta (Facebook). Toma unos 5 minutos.</p>
      </section>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .add {
      border: 2px dashed var(--primary-200);
      background: var(--color-primary-softer);
      border-radius: var(--radius-lg);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      text-align: center;
      padding: 18px;
      color: var(--color-primary-text);
      --icon-size: 26px;
      // Only its own text: the button's label is a span too, and must keep the button's colour.
      > span {
        font-size: 12.5px;
        color: var(--color-text-muted);
        max-width: 260px;
      }
      .btn {
        margin-top: 6px;
      }
    }
    .start {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 6px;
      padding: 26px 20px;
      b {
        font-size: 16px;
      }
      p {
        font-size: 13px;
        color: var(--color-text-muted);
      }
      ol {
        list-style: none;
        padding: 0;
        margin: 10px 0 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: min(420px, 100%);
        text-align: left;
      }
      li {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: var(--color-text-2);
        background: var(--color-surface-muted);
        border: 1px solid var(--color-border-soft);
        border-radius: var(--radius-sm);
        padding: 8px 10px;
      }
      i {
        font-style: normal;
        width: 22px;
        height: 22px;
        flex: none;
        border-radius: 50%;
        background: var(--color-primary-soft);
        color: var(--color-primary-text);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 12px;
      }
    }
    .wa {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--color-whatsapp-soft);
      color: var(--color-whatsapp-text);
      display: flex;
      align-items: center;
      justify-content: center;
      --icon-size: 24px;
      margin-bottom: 2px;
      &.big {
        width: 56px;
        height: 56px;
        --icon-size: 30px;
      }
    }
    .more {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 6px;
      padding: 18px;
      p {
        font-size: 12.5px;
        color: var(--color-text-muted);
        max-width: 260px;
      }
      .btn {
        margin-top: 6px;
      }
    }
    .btn--whatsapp {
      background: var(--color-whatsapp);
      border-color: var(--color-whatsapp);
      color: var(--color-on-whatsapp);
      gap: 8px;
      --icon-size: 18px;
      &:hover:not(:disabled) {
        background: var(--color-whatsapp-strong);
        border-color: var(--color-whatsapp-strong);
      }
      &.btn--lg {
        --icon-size: 20px;
      }
    }
    .secure {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: var(--color-text-muted);
      --icon-size: 13px;
    }
    .pay {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
    }
    .pay-head {
      display: flex;
      align-items: center;
      gap: 10px;
      b {
        display: block;
        font-size: 14.5px;
      }
      span {
        font-size: 12.5px;
        color: var(--color-text-muted);
      }
    }
    .ok {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--color-success-soft);
      color: var(--color-success);
      display: flex;
      align-items: center;
      justify-content: center;
      --icon-size: 20px;
    }
    .row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .hint {
      font-size: 12px;
      color: var(--color-text-muted);
    }
  `,
})
export class ConnectWhatsappCard {
  /** The company already has numbers: a small box next to them instead of the full card. */
  readonly compact = input(false);

  protected readonly signup = inject(ChannelSignupActions);
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);

  protected readonly connected = signal<Connected | null>(null);
  protected readonly busy = computed(() => this.signup.state() === 'loading' || this.signup.connecting());
  protected readonly billingUrl = computed(() => metaBillingUrl(this.connected()?.wabaId ?? ''));

  constructor() {
    void this.signup.prepare(this.session.tenant()?.id ?? '');
  }

  /** Synchronous up to Meta's window: the browser only lets a click open it. */
  protected connect(): void {
    void this.signup.connect(this.session.tenant()?.id ?? '').then((outcome) => {
      if (outcome.kind === 'connected') {
        this.connected.set(outcome);
        this.toaster.show(`Número ${outcome.result.displayNumber} conectado`);
      } else if (outcome.kind === 'error') {
        this.toaster.show(outcome.message, 'info');
      }
    });
  }
}
