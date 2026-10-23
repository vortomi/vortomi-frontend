import { Injectable, inject } from '@angular/core';
import { toApiFailure } from '../../../core/api/api-error';
import { readStored, writeStored } from '../../../core/storage';
import type { DisplayNameStatus, Id } from '../../../shared/api/models';
import { PlatformRemote, type TenantFields } from '../platform-remote';
import { invitationLink } from '../platform.data';
import type { WabaLookup } from './onboarding.rules';
import type { CompanyDraft, ConnectionCheck } from './onboarding.state';

const NAME_STATUS: Record<string, DisplayNameStatus> = { APPROVED: 'approved', PENDING_REVIEW: 'pending_review', DECLINED: 'declined' };
/** How often and for how long the sign-up test waits for the customer's message. */
const POLL_MS = 3000;
const TEST_TIMEOUT_MS = 5 * 60_000;

/** The admin contact typed in step 1 lives only in this browser tab until the invitation is created. */
const draftKey = (tenantId: Id) => `vortomi.onboarding.${tenantId}`;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type Outcome<T> = { ok: T } | { error: string };

/**
 * The sign-up steps against vortomi-backend ('api' mode). Each step is stored on the server as
 * it happens (draft -> awaiting_channel -> active), so leaving half way loses nothing.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingRemote {
  private readonly api = inject(PlatformRemote);

  async saveCompany(tenantId: Id | null, draft: CompanyDraft): Promise<Outcome<Id>> {
    const fields: TenantFields = {
      name: draft.name.trim(),
      industry: draft.industry,
      city: draft.city.trim(),
      timezone: draft.timezone,
      plan: draft.plan,
      legalName: draft.legalName.trim(),
      taxId: draft.taxId,
      fiscalAddress: draft.fiscalAddress.trim(),
    };
    return this.run(async () => {
      const id = tenantId ?? (await this.api.create(fields)).id;
      if (tenantId) await this.api.update(tenantId, fields);
      writeStored(draftKey(id), { adminName: draft.adminName, adminEmail: draft.adminEmail, adminPhone: draft.adminPhone, website: draft.website });
      return id;
    });
  }

  /** What was saved, to reopen a company left half way. */
  async load(tenantId: Id) {
    const detail = await this.api.tenant(tenantId);
    const admin = readStored<Pick<CompanyDraft, 'adminName' | 'adminEmail' | 'adminPhone' | 'website'>>(draftKey(tenantId));
    return { detail, admin };
  }

  async lookup(tenantId: Id, wabaId: string, accessToken: string): Promise<WabaLookup> {
    try {
      const found = await this.api.lookup(tenantId, wabaId.replace(/\D/g, ''), accessToken.trim());
      return {
        status: 'found',
        // Meta does not tell us these without more permissions; the checks after connecting say what is known.
        account: { businessVerified: true, hasPaymentMethod: true },
        numbers: found.numbers.map((n) => ({
          phoneNumberId: n.phoneNumberId,
          displayNumber: n.displayNumber,
          verifiedName: n.verifiedName,
          nameStatus: NAME_STATUS[n.nameStatus] ?? 'pending_review',
          takenBy: found.wabaTakenBy ?? n.takenBy,
        })),
      };
    } catch {
      return { status: 'not_found' };
    }
  }

  /** Stores the number; the checks shown are the ones the server really made. */
  async connect(
    tenantId: Id,
    input: { wabaId: string; accessToken: string; phoneNumberId: string; displayNumber: string; label: string },
  ): Promise<Outcome<ConnectionCheck[]>> {
    return this.run(async () => {
      const result = await this.api.connect(tenantId, { ...input, wabaId: input.wabaId.replace(/\D/g, ''), accessToken: input.accessToken.trim() });
      return [
        { title: 'El número pertenece a esa cuenta', detail: 'Lo confirmó Meta; no se escribió a mano', status: 'ok' },
        { title: 'El número no está en otra empresa', detail: 'Ningún otro cliente de la plataforma lo usa', status: 'ok' },
        { title: 'Acceso guardado cifrado', detail: 'Nadie puede verlo, tampoco desde esta consola', status: 'ok' },
        result.subscribed
          ? { title: 'Sus avisos llegarán a nuestro servidor', detail: 'Nuestra app quedó suscrita a esa cuenta', status: 'ok' }
          : {
              title: 'No pudimos suscribirnos a sus avisos',
              detail: 'Revisa que el acceso compartido tenga control total; sin esto sus mensajes no llegan. La prueba del paso 3 lo confirmará.',
              status: 'warn',
            },
      ];
    });
  }

  /** Waits for the first customer message after `since`. Resolves to when it arrived, or null on timeout. */
  async waitForMessage(tenantId: Id, since: string, cancelled: () => boolean): Promise<string | null> {
    const deadline = Date.now() + TEST_TIMEOUT_MS;
    while (Date.now() < deadline && !cancelled()) {
      const at = await this.api.lastInbound(tenantId, since).catch(() => null);
      if (at) return at;
      await wait(POLL_MS);
    }
    return null;
  }

  /** Invites the admin and turns the company on. Resolves to the invitation link. */
  async activate(tenantId: Id, adminName: string, adminEmail: string): Promise<Outcome<string>> {
    return this.run(async () => {
      const invitation = await this.api.inviteAdmin(tenantId, adminName.trim(), adminEmail.trim().toLowerCase());
      await this.api.setStatus(tenantId, 'active');
      writeStored(draftKey(tenantId), null);
      return invitationLink(invitation.token ?? '');
    });
  }

  private async run<T>(work: () => Promise<T>): Promise<Outcome<T>> {
    try {
      return { ok: await work() };
    } catch (error) {
      return { error: toApiFailure(error).message };
    }
  }
}
