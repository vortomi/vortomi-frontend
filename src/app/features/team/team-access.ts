import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Directory } from '../../core/directory';
import { Session } from '../../core/session';
import type { ApiIssuedReset, ApiResetBlock, ApiTeamAccess } from '../../shared/api/contract';
import type { Id } from '../../shared/api/models';
import { resetLinkOf } from '../../shared/ui/reset-link.dialog';
import { DEMO_RESET_TOKEN } from '../auth/password-reset.remote';

export type TeamPerson = ApiTeamAccess['people'][number];
export type TeamEvent = ApiTeamAccess['history'][number];

/** Why «Restablecer contraseña» is off for someone, as the menu says it. */
export function resetBlockText(block: ApiResetBlock | null, youAreOwner: boolean, firstName: string): string | null {
  if (!youAreOwner) return 'Solo el dueño de la empresa puede hacerlo.';
  switch (block) {
    case 'self':
      return 'Es tu cuenta: cámbiala desde Mi perfil.';
    case 'elsewhere':
      return `${firstName} también trabaja en otra empresa: su contraseña solo la puede restablecer Vortomi. Escríbenos y lo hacemos.`;
    case 'staff':
      return `${firstName} es del staff de Vortomi: se restablece desde la consola.`;
    case 'inactive':
      return 'Está desactivada: reactívala primero.';
    default:
      return null;
  }
}

/** One line of «Historial del equipo». Actor null: our console («Vortomi»). */
export function teamEventLine(event: TeamEvent): { actor: string; text: string; subject: string | null; icon: 'lock' | 'check' | 'mail'; tone: 'amber' | 'green' | 'blue' } {
  const actor = event.actor ?? 'Vortomi';
  switch (event.kind) {
    case 'reset_given':
      return { actor, text: 'le dio un enlace a', subject: `${event.subject} para restablecer su contraseña`, icon: 'lock', tone: 'amber' };
    case 'reset_used':
      return { actor, text: 'eligió su contraseña nueva', subject: null, icon: 'check', tone: 'green' };
    case 'invited':
      return { actor, text: 'invitó a', subject: event.subject, icon: 'mail', tone: 'blue' };
    case 'joined':
      return { actor, text: 'entró al equipo', subject: null, icon: 'check', tone: 'green' };
  }
}

/**
 * What the team table adds for admins (mockup web-30): who is the owner, each person's last access,
 * who can get a password link from here (and why not) and the team's history; and the owner giving
 * a link. 'mock': worked out from the sample tables.
 */
@Injectable({ providedIn: 'root' })
export class TeamAccess {
  private readonly api = inject(ApiClient);
  private readonly session = inject(Session);
  private readonly directory = inject(Directory);
  private readonly preview = inject(API_CONFIG).mode !== 'api';

  private readonly remoteAccess = signal<ApiTeamAccess | null>(null);
  readonly access = computed<ApiTeamAccess | null>(() => (this.preview ? this.sample() : this.remoteAccess()));
  readonly byUser = computed(() => new Map((this.access()?.people ?? []).map((p) => [p.userId, p])));

  /** Admins only; anyone else has nothing to load. Resolves to an error sentence, or null. */
  async load(): Promise<string | null> {
    const tenantId = this.session.tenant()?.id;
    if (this.preview || !tenantId || !this.session.isTenantAdmin()) return null;
    try {
      this.remoteAccess.set(await this.api.get<ApiTeamAccess>(this.api.company(tenantId, 'team/access')));
      return null;
    } catch (error) {
      return toApiFailure(error).message;
    }
  }

  /** The owner gives a link: shown once. */
  async giveLink(userId: Id): Promise<{ link: string; name: string } | { error: string }> {
    const tenantId = this.session.tenant()?.id ?? '';
    if (this.preview) return { link: resetLinkOf(DEMO_RESET_TOKEN), name: this.directory.userById().get(userId)?.name ?? '' };
    try {
      const issued = await this.api.post<ApiIssuedReset>(this.api.company(tenantId, `team/${encodeURIComponent(userId)}/password-reset`), {});
      void this.load();
      return { link: resetLinkOf(issued.token), name: issued.name };
    } catch (error) {
      return { error: toApiFailure(error).message };
    }
  }

  /** Preview mode: the owner is the first admin of the sample company; Laura in Repuestos Andinos. */
  private sample(): ApiTeamAccess {
    const tenantId = this.session.tenant()?.id ?? '';
    const me = this.session.user()?.id ?? '';
    const all = this.directory.memberships();
    const here = all.filter((m) => m.tenantId === tenantId && m.status !== 'invited');
    const owner = here.find((m) => m.role === 'admin' && m.status === 'active')?.userId ?? null;
    const users = this.directory.userById();
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    const people = here.map((m, index): TeamPerson => {
      const elsewhere = all.some((o) => o.userId === m.userId && o.tenantId !== tenantId);
      const staff = users.get(m.userId)?.platformRole === 'super_admin';
      const blocked: ApiResetBlock | null = m.userId === me ? 'self' : staff ? 'staff' : elsewhere ? 'elsewhere' : m.status !== 'active' ? 'inactive' : null;
      return { userId: m.userId, isOwner: m.userId === owner, lastSignInAt: m.userId === me ? hoursAgo(0) : hoursAgo([2, 26, 74, 150][index % 4]!), elsewhere, blocked };
    });
    const name = (id: Id | null | undefined) => (id ? (users.get(id)?.name ?? '') : '');
    const someone = here.find((m) => m.userId !== owner && m.status === 'active')?.userId;
    const history: TeamEvent[] = someone
      ? [
          { kind: 'reset_used', actor: name(someone), subject: name(someone), at: hoursAgo(0.08) },
          { kind: 'reset_given', actor: name(owner), subject: name(someone), at: hoursAgo(0.17) },
          { kind: 'invited', actor: name(owner), subject: name(here.at(-1)?.userId), at: hoursAgo(26) },
        ]
      : [];
    return { youAreOwner: me === owner, available: true, people, history };
  }
}
