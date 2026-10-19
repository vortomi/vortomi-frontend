import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormField, apply, form, required, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { Clock } from '../../core/clock';
import { Directory } from '../../core/directory';
import { formatTime } from '../../shared/format/date-time';
import { type NewPassword, emptyNewPassword, newPasswordSchema } from '../../shared/security/new-password.schema';
import { Avatar } from '../../shared/ui/avatar';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { PasswordMeter } from '../../shared/ui/password-meter';
import { InvitationAcceptance } from './invitation-acceptance';
import { invitationStatus } from './invitation-status';
import { BRAND } from '../../core/brand';

interface AcceptModel {
  name: string;
  secret: NewPassword;
  terms: boolean;
}

/** Where an invited person creates their password (mockup web-13). */
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
  private readonly directory = inject(Directory);
  private readonly clock = inject(Clock);
  private readonly acceptance = inject(InvitationAcceptance);
  private readonly router = inject(Router);

  /** From the route: /invitation/:token */
  readonly token = input<string>();

  protected readonly invitation = computed(
    () => this.directory.invitations().find((i) => i.demoToken === this.token()) ?? null,
  );
  protected readonly status = computed(() => invitationStatus(this.invitation(), this.clock.now()));
  protected readonly tenant = computed(() => this.directory.tenantById().get(this.invitation()?.tenantId ?? ''));
  protected readonly inviter = computed(() => this.directory.userById().get(this.invitation()?.invitedByUserId ?? '')?.name);
  protected readonly roleLabel = computed(() => (this.invitation()?.role === 'admin' ? 'administración' : 'agente'));
  protected readonly expiresLabel = computed(() => {
    const invitation = this.invitation();
    if (!invitation) return '';
    const date = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', timeZone: 'America/Caracas' })
      .format(new Date(invitation.expiresAt))
      .replace('.', '');
    return `${date}, ${formatTime(invitation.expiresAt, 'America/Caracas')}`;
  });

  private readonly model = signal<AcceptModel>({ name: '', secret: emptyNewPassword(), terms: false });
  protected readonly acceptForm = form(this.model, (path) => {
    required(path.name, { message: 'Escribe tu nombre.' });
    apply(path.secret, newPasswordSchema);
    validate(path.terms, ({ value }) =>
      value() ? undefined : { kind: 'terms', message: 'Acepta los términos para continuar.' },
    );
  });

  constructor() {
    // Prefill the name the inviter typed; the person can correct it.
    effect(() => {
      const name = this.invitation()?.name;
      if (name) untracked(() => this.model.update((m) => (m.name ? m : { ...m, name })));
    });
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const invitation = this.invitation();
    if (!invitation || this.status() !== 'valid') return;
    await submit(this.acceptForm, async () => {
      this.acceptance.accept(invitation, this.model().name.trim());
      await this.router.navigateByUrl('/inbox');
      return undefined;
    });
  }
}
