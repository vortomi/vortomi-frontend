import { Component, computed, inject, signal } from '@angular/core';
import { ApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import { ROLE } from '../../shared/api/labels';
import type { Id } from '../../shared/api/models';
import { formatShortDate } from '../../shared/format/date-time';
import { Avatar } from '../../shared/ui/avatar';
import { Confirm } from '../../shared/ui/confirm';
import { Icon } from '../../shared/ui/icon';
import { InvitationLinkDialog } from '../../shared/ui/invitation-link.dialog';
import { Pill } from '../../shared/ui/pill';
import { ResetLinkDialog } from '../../shared/ui/reset-link.dialog';
import { RowMenu } from '../../shared/ui/row-menu';
import { Skeleton } from '../../shared/ui/skeleton';
import { Toaster } from '../../shared/ui/toaster';
import { ago } from '../platform/usage-overview.rules';
import { InviteDialog } from './invite.dialog';
import { MemberAccessDialog } from './member-access.dialog';
import { TeamAccess, resetBlockText, teamEventLine } from './team-access';
import type { MemberAccess } from './team-remote';
import { type PendingInvitation, TeamActions, type TeamMemberRow } from './team.actions';
import { PLAN_SEATS } from './team.rules';

/**
 * «Equipo» of Canales y equipo (mockups web-6 and web-30): who works in the company, their role and
 * last access, the owner, and each person's ⋯ menu (role, password link, disable); the team's history,
 * pending invitations and disabled people. Changes happen in dialogs; risky ones ask first.
 */
@Component({
  selector: 'app-team-section',
  imports: [Avatar, Icon, InvitationLinkDialog, InviteDialog, MemberAccessDialog, Pill, ResetLinkDialog, RowMenu, Skeleton],
  templateUrl: './team-section.html',
  styleUrls: ['./team-titles.scss', './team-section.scss'],
})
export class TeamSection {
  protected readonly session = inject(Session);
  protected readonly team = inject(TeamActions);
  protected readonly access = inject(TeamAccess);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly labels = { role: ROLE };
  protected readonly inviting = signal(false);
  protected readonly editingMember = signal<TeamMemberRow | null>(null);
  protected readonly link = signal<{ link: string; name: string } | null>(null);
  protected readonly resetLink = signal<{ link: string; name: string } | null>(null);
  /** The team and its invitations arrived. */
  protected readonly loaded = signal(false);

  protected readonly admin = computed(() => this.session.isTenantAdmin());
  protected readonly seats = computed(() => ({ used: this.team.seatsUsed(), total: PLAN_SEATS[this.session.tenant()?.plan ?? 'basic'] }));
  protected readonly active = computed(() => this.team.members().filter((m) => m.membership.status === 'active'));
  protected readonly disabled = computed(() => this.team.members().filter((m) => m.membership.status === 'disabled'));
  protected readonly history = computed(() => this.access.access()?.history ?? []);
  protected readonly eventLine = teamEventLine;
  /** Bound once so the dialog keeps the same function between renders. */
  protected readonly saveAccess = (userId: Id, access: MemberAccess) => this.team.updateMember(userId, access);

  constructor() {
    void Promise.all([this.team.load(), this.access.load()]).then((errors) => {
      this.loaded.set(true);
      const error = errors.find(Boolean);
      if (error) this.toaster.show(error, 'info');
    });
  }

  protected lastAccess(iso: string | null): string {
    return iso ? ago(iso, new Date()) : 'Todavía no entra';
  }

  /** Why «Restablecer contraseña» is off for this person, or null when the link can be given. */
  protected resetBlocked(row: TeamMemberRow): string | null {
    const access = this.access.access();
    if (!access) return 'Cargando…';
    if (!access.available) return 'No está disponible en este momento.';
    return resetBlockText(this.access.byUser().get(row.user.id)?.blocked ?? null, access.youAreOwner, row.user.name.split(' ')[0] ?? '');
  }

  protected async giveLink(row: TeamMemberRow): Promise<void> {
    let given: { link: string; name: string } | null = null;
    const done = await this.confirm.ask({
      title: `¿Restablecer la contraseña de ${row.user.name}?`,
      message: 'Su contraseña actual deja de servir y se cierran sus sesiones. Le das un enlace de un solo uso para que elija una nueva; nadie más la conoce.',
      confirmLabel: 'Crear enlace',
      action: async () => {
        const result = await this.access.giveLink(row.user.id);
        if ('error' in result) failIf(result.error);
        else given = result;
      },
    });
    if (done && given) this.resetLink.set(given);
  }

  protected expires(invitation: PendingInvitation): string {
    const expired = new Date(invitation.expiresAt).getTime() < Date.now();
    return expired ? 'Vencida' : `Vence el ${formatShortDate(invitation.expiresAt, this.session.timezone())}`;
  }

  protected accessSaved(): void {
    const name = this.editingMember()?.user.name ?? '';
    this.editingMember.set(null);
    this.toaster.show(`Acceso de ${name} guardado`);
  }

  protected async disable(row: TeamMemberRow): Promise<void> {
    const done = await this.confirm.ask({
      title: `¿Desactivar a ${row.user.name}?`,
      message: 'No podrá entrar a la empresa. Sus conversaciones y su historial se conservan, y puedes reactivarla cuando quieras.',
      confirmLabel: 'Desactivar',
      danger: true,
      action: async () => failIf(await this.team.setActive(row.user.id, false)),
    });
    if (done) this.toaster.show(`${row.user.name} desactivada`);
  }

  protected async reactivate(row: TeamMemberRow): Promise<void> {
    const done = await this.confirm.ask({
      title: `¿Reactivar a ${row.user.name}?`,
      message: 'Vuelve a entrar a la empresa con el mismo rol y los mismos números que tenía.',
      confirmLabel: 'Reactivar',
      action: async () => failIf(await this.team.setActive(row.user.id, true)),
    });
    if (done) this.toaster.show(`${row.user.name} puede entrar de nuevo`);
  }

  protected async renew(invitation: PendingInvitation): Promise<void> {
    let link: string | null = null;
    const done = await this.confirm.ask({
      title: `¿Crear un enlace nuevo para ${invitation.name}?`,
      message: 'El enlace anterior deja de funcionar y el nuevo vale 72 horas.',
      confirmLabel: 'Crear enlace',
      action: async () => {
        const result = await this.team.renew(invitation.id);
        if ('error' in result) failIf(result.error);
        else link = result.link;
      },
    });
    if (done && link) this.link.set({ link, name: invitation.name });
  }

  protected async revoke(invitation: PendingInvitation): Promise<void> {
    const done = await this.confirm.ask({
      title: `¿Anular la invitación de ${invitation.name}?`,
      message: 'El enlace deja de funcionar. Si cambias de idea, invítala de nuevo.',
      confirmLabel: 'Anular invitación',
      danger: true,
      action: async () => failIf(await this.team.revoke(invitation.id)),
    });
    if (done) this.toaster.show('Invitación anulada');
  }
}

/** The team's actions answer an error sentence or null; a confirmation's action needs a throw to stay open. */
function failIf(error: string | null): void {
  if (error) throw new ApiFailure(0, 'failed', error);
}
