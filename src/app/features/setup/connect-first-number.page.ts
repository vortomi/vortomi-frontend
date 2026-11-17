import { ChangeDetectionStrategy, Component, type OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { RemoteSession } from '../../core/remote/remote-session';
import { Session } from '../../core/session';
import { BrandMark } from '../../shared/ui/brand-mark';
import { Icon } from '../../shared/ui/icon';
import { ThemeToggle } from '../../shared/ui/theme-toggle';
import { Toaster } from '../../shared/ui/toaster';
import { WhatsappLogo } from '../../shared/ui/whatsapp-logo';
import { ChannelSignupActions, type ConnectResult, metaBillingUrl } from '../team/channel-signup.actions';

type Connected = Extract<ConnectResult, { kind: 'connected' }>;

/**
 * «Conecta tu WhatsApp» (mockup web-21, screens 4 and 5): the only screen of a company that waits for
 * its owner. The owner connects the first number with Meta's window; the server puts the company live
 * at that moment, and the panel opens (then the usual welcome).
 */
@Component({
  selector: 'app-connect-first-number-page',
  imports: [BrandMark, Icon, ThemeToggle, WhatsappLogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="top">
        <app-brand-mark class="logo" />
        <div><b>Vortomi</b><span class="sub">{{ companyName() }}</span></div>
        <span class="spacer"></span>
        <app-theme-toggle align="right" />
        <button type="button" class="btn btn--ghost" (click)="signOut()"><span>Cerrar sesión</span></button>
      </header>

      <main class="card body">
        @if (connected(); as done) {
          <span class="ok"><app-icon name="check" [stroke]="3" /></span>
          <h1>¡Listo, tu WhatsApp está conectado!</h1>
          <p class="lead">{{ done.result.displayNumber }}</p>
          <ul class="after">
            @if (done.result.coexistence) {
              <li><app-icon name="inbox" /><span>Tus chats anteriores y tus contactos se están copiando a Vortomi.</span></li>
            }
            @if (!done.result.subscribed) {
              <li class="warn"><app-icon name="alert" /><span>Meta no confirmó que nos enviará los mensajes de este número. Escríbenos y lo revisamos contigo.</span></li>
            }
            <li>
              <app-icon name="shield" />
              <span><b>Agrega tu tarjeta en Meta</b> para que no se corten las respuestas. Vortomi nunca te la pedirá.
                <a [href]="billingUrl()" target="_blank" rel="noopener noreferrer">Pago a Meta ↗</a></span>
            </li>
          </ul>
          <button type="button" class="btn btn--primary btn--lg" [disabled]="entering()" [attr.aria-busy]="entering()" (click)="enter()">
            <span>Entrar a mi panel</span><app-icon name="arrow" />
          </button>
        } @else {
          <h1>Conecta tu WhatsApp</h1>
          <p class="lead">Es el último paso. Tus clientes te seguirán escribiendo al mismo número y tú podrás seguir usando WhatsApp Business en tu teléfono.</p>
          <ol class="need">
            <li><i>1</i>Tu cuenta de Facebook (la personal sirve)</li>
            <li><i>2</i>El teléfono donde tienes el WhatsApp del negocio</li>
            <li><i>3</i>Unos 5 minutos</li>
          </ol>
          @if (signup.state() === 'unavailable') {
            <p class="form-alert info"><app-icon name="alert" />Todavía no podemos conectarlo desde aquí. Escríbenos y lo hacemos contigo.</p>
          } @else {
            <button type="button" class="btn btn--whatsapp btn--lg" [disabled]="busy()" [attr.aria-busy]="busy()" (click)="connect()">
              <app-whatsapp-logo /><span>Conectar con WhatsApp</span>
            </button>
            <p class="secure"><app-icon name="lock" />Se abre una ventana segura de Meta (Facebook).</p>
          }
          <p class="help">¿Te trabaste? Escríbenos y lo hacemos contigo por videollamada.</p>
        }
      </main>
    </div>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: var(--color-canvas); }
    .page { max-width: 640px; margin: 0 auto; padding: 32px 20px 48px; }
    .top { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
    .top .logo { width: 36px; height: 36px; }
    .top b { display: block; font-size: 16px; font-weight: 700; }
    .top .sub { font-size: 13px; color: var(--color-text-muted); }
    .spacer { flex: 1; }
    .body { padding: 32px 30px; display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
    h1 { font-size: 22px; font-weight: 700; }
    .lead { color: var(--color-text-muted); font-size: 14.5px; line-height: 1.5; max-width: 460px; }
    .need { list-style: none; padding: 0; margin: 4px 0; display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 420px; text-align: left; }
    .need li { display: flex; gap: 10px; align-items: center; font-size: 14px; padding: 10px 12px; border-radius: var(--radius-md);
      background: var(--color-surface-hover); }
    .need i { font-style: normal; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; background: var(--color-primary-soft); color: var(--color-primary); flex-shrink: 0; }
    .secure, .help { font-size: 12.5px; color: var(--color-text-muted); display: flex; gap: 6px; align-items: center; --icon-size: 14px; }
    .form-alert { text-align: left; }
    .ok { width: 56px; height: 56px; border-radius: 50%; background: var(--color-success); color: #fff; display: flex; align-items: center;
      justify-content: center; --icon-size: 28px; }
    .after { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 460px; text-align: left; }
    .after li { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; line-height: 1.45; padding: 10px 12px;
      border-radius: var(--radius-md); background: var(--color-surface-hover); --icon-size: 18px; }
    .after li.warn { background: var(--color-warning-soft); }
    .after a { font-weight: 600; white-space: nowrap; }
  `,
})
export class ConnectFirstNumberPage implements OnInit {
  /** From the route: /connect-whatsapp/:tenantId (joiningGuard checked it is a company waiting for me). */
  readonly tenantId = input.required<string>();

  protected readonly signup = inject(ChannelSignupActions);
  private readonly session = inject(Session);
  private readonly remoteSession = inject(RemoteSession);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly connected = signal<Connected | null>(null);
  protected readonly entering = signal(false);
  protected readonly busy = computed(() => this.signup.state() === 'loading' || this.signup.connecting());
  protected readonly companyName = computed(() => this.session.myTenants().find((t) => t.id === this.tenantId())?.name ?? '');
  protected readonly billingUrl = computed(() => metaBillingUrl(this.connected()?.wabaId ?? ''));

  ngOnInit(): void {
    void this.signup.prepare(this.tenantId());
  }

  /** Synchronous up to Meta's window: the browser only lets a click open it. */
  protected connect(): void {
    void this.signup.connect(this.tenantId()).then((outcome) => {
      if (outcome.kind === 'connected') this.connected.set(outcome);
      else if (outcome.kind === 'error') this.toaster.show(outcome.message, 'info');
    });
  }

  /** The company is live now: read who I am again (its new status) and open its panel. */
  protected async enter(): Promise<void> {
    this.entering.set(true);
    try {
      await this.remoteSession.loadMe();
      if (this.session.switchTenant(this.tenantId())) await this.router.navigateByUrl('/inbox');
      else this.toaster.show('Tu número quedó conectado. Estamos activando tu empresa: inténtalo en un momento.', 'info');
    } finally {
      this.entering.set(false);
    }
  }

  protected signOut(): void {
    this.auth.signOut();
    void this.router.navigateByUrl('/login');
  }
}
