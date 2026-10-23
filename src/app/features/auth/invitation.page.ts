import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormField, apply, form, required, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { API_CONFIG } from '../../core/api/api-config';
import { BRAND } from '../../core/brand';
import { Clock } from '../../core/clock';
import { Directory } from '../../core/directory';
import type { TenantRole } from '../../shared/api/models';
import { formatTime } from '../../shared/format/date-time';
import { type NewPassword, emptyNewPassword, newPasswordSchema } from '../../shared/security/new-password.schema';
import { Avatar } from '../../shared/ui/avatar';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { PasswordMeter } from '../../shared/ui/password-meter';
import { InvitationAcceptance } from './invitation-acceptance';
import { InvitationRemote } from './invitation-remote';
import { invitationStatus } from './invitation-status';

interface AcceptModel {
  name: string;
  secret: NewPassword;
  terms: boolean;
}

/** What the page shows about an invitation, whichever mode it came from. */
interface InvitationView {
  companyName: string;
  companyDetail: string | null;
  companySeed: string;
  inviter: string | null;
  email: string;
  name: string;
  role: TenantRole;
  expiresAt: string;
  /** The email already has an account: the person only types their password. */
  hasAccount: boolean;
}

type PageState = { status: 'loading' } | { status: 'valid'; view: InvitationView } | { status: 'expired' | 'used' | 'missing' };

/** Where an invited person creates their password, or enters with the one they have (mockup web-13). */
@Component({
  selector: 'app-invitation-page',
  imports: [FormField, RouterLink, Avatar, FieldError, Icon, PasswordMeter],
  templateUrl: './invitation.page.html',
  styles: `
    .company { display: flex; align-items: center; gap: 12px; border: 1px solid var(--color-border); background: var(--color-surface);
      border-radius: var(--radius-lg); padding: 12px 14px; }
    .company .logo { border-radius: 10px; }
    .company b { display: block; }
    .company small { font-size: 12.5px; color: var(--color-text-muted); }
    .expiry { display: flex; align-items: center; justify-content: center; gap: 7px; font-size: 12px; color: var(--color-text-muted); --icon-size: 14px; }
  `,
})
export class InvitationPage {
  protected readonly brand = BRAND;
  protected readonly demo = inject(API_CONFIG).mode === 'mock';
  private readonly directory = inject(Directory);
  private readonly clock = inject(Clock);
  private readonly acceptance = inject(InvitationAcceptance);
  private readonly remote = this.demo ? null : inject(InvitationRemote);
  private readonly router = inject(Router);

  /** From the route: /invitation/:token */
  readonly token = input<string>();

  private readonly remoteState = signal<PageState>({ status: 'loading' });
  private readonly mockInvitation = computed(() => this.directory.invitations().find((i) => i.demoToken === this.token()) ?? null);

  protected readonly state = computed<PageState>(() => {
    if (this.remote) return this.remoteState();
    const invitation = this.mockInvitation();
    const status = invitationStatus(invitation, this.clock.now());
    if (status !== 'valid' || !invitation) return { status: status === 'valid' ? 'missing' : status };
    const tenant = this.directory.tenantById().get(invitation.tenantId);
    return {
      status: 'valid',
      view: {
        companyName: tenant?.name ?? '',
        companyDetail: tenant ? `${tenant.industry} · ${tenant.city}` : null,
        companySeed: invitation.tenantId,
        inviter: this.directory.userById().get(invitation.invitedByUserId)?.name ?? null,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        hasAccount: false,
      },
    };
  });
  protected readonly view = computed(() => {
    const state = this.state();
    return state.status === 'valid' ? state.view : null;
  });
  protected readonly roleLabel = computed(() => (this.view()?.role === 'admin' ? 'administración' : 'agente'));
  protected readonly expiresLabel = computed(() => {
    const view = this.view();
    if (!view) return '';
    const date = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', timeZone: 'America/Caracas' })
      .format(new Date(view.expiresAt))
      .replace('.', '');
    return `${date}, ${formatTime(view.expiresAt, 'America/Caracas')}`;
  });

  protected readonly error = signal<string | null>(null);
  private readonly model = signal<AcceptModel>({ name: '', secret: emptyNewPassword(), terms: false });
  protected readonly acceptForm = form(this.model, (path) => {
    required(path.name, { message: 'Escribe tu nombre.' });
    apply(path.secret, newPasswordSchema);
    validate(path.terms, ({ value }) => (value() ? undefined : { kind: 'terms', message: 'Acepta los términos para continuar.' }));
  });

  /** For someone who already has an account: just their current password. */
  private readonly loginModel = signal({ password: '' });
  protected readonly loginForm = form(this.loginModel, (path) => {
    required(path.password, { message: 'Escribe tu contraseña.' });
  });

  constructor() {
    // 'api' mode: ask the server what this link is.
    effect(() => {
      const token = this.token();
      const remote = this.remote;
      if (!remote || !token) return;
      untracked(() => {
        this.remoteState.set({ status: 'loading' });
        void remote.lookup(token).then((found) => this.remoteState.set(found.status === 'valid' ? { status: 'valid', view: fromPreview(found.preview, token) } : found));
      });
    });
    // Prefill the name the inviter typed; the person can correct it.
    effect(() => {
      const name = this.view()?.name;
      if (name) untracked(() => this.model.update((m) => (m.name ? m : { ...m, name })));
    });
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const view = this.view();
    if (!view) return;
    const run = async (password: string) => {
      this.error.set(null);
      const problem = await this.accept(view, password, this.model().name.trim());
      if (problem) {
        this.error.set(problem);
        return undefined;
      }
      await this.router.navigateByUrl('/inbox');
      return undefined;
    };
    // Two forms, one action: an existing account only types its password.
    if (view.hasAccount) await submit(this.loginForm, () => run(this.loginModel().password));
    else await submit(this.acceptForm, () => run(this.model().secret.password));
  }

  private async accept(view: InvitationView, password: string, name: string): Promise<string | null> {
    const token = this.token() ?? '';
    if (this.remote) {
      const state = this.remoteState();
      if (state.status !== 'valid') return 'Esta invitación ya no es válida.';
      return this.remote.accept(token, { companyName: view.companyName, email: view.email, name: view.name, role: view.role, expiresAt: view.expiresAt, hasAccount: view.hasAccount }, password, name);
    }
    const invitation = this.mockInvitation();
    if (!invitation) return 'Esta invitación ya no es válida.';
    this.acceptance.accept(invitation, name);
    return null;
  }
}

function fromPreview(preview: { companyName: string; email: string; name: string; role: TenantRole; expiresAt: string; hasAccount: boolean }, seed: string): InvitationView {
  return { ...preview, companyDetail: null, companySeed: seed, inviter: null };
}
