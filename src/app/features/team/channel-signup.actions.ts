import { Injectable, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { RemoteSession } from '../../core/remote/remote-session';
import type { ApiSignupResult } from '../../shared/api/contract';
import type { Id } from '../../shared/api/models';
import { MetaSignup, type SignupLaunchConfig } from './meta-signup';
import { TeamRemote } from './team-remote';

/**
 * Where the owner adds the card Meta charges the bot's messages to: the company's own account in
 * Meta's WhatsApp Manager. A fixed Meta address: nothing from the server or the page can change it.
 */
export function metaBillingUrl(wabaId: string): string {
  return `https://business.facebook.com/wa/manage/home/?waba_id=${encodeURIComponent(wabaId)}`;
}

export type SignupState = 'unavailable' | 'loading' | 'ready';

export type ConnectResult = { kind: 'connected'; result: ApiSignupResult; wabaId: string } | { kind: 'cancelled' } | { kind: 'error'; message: string };

type Sdk = Awaited<ReturnType<MetaSignup['prepare']>>;

/**
 * «Conectar WhatsApp» for the company's admins: asks the server whether it is offered, gets Meta's
 * SDK ready before the click, runs the window and hands the result to the server. Only in 'api'
 * mode (the prototype has no Meta).
 */
@Injectable({ providedIn: 'root' })
export class ChannelSignupActions {
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(TeamRemote) : null;
  private readonly remoteSession = inject(RemoteSession);
  private readonly meta = inject(MetaSignup);

  readonly state = signal<SignupState>('unavailable');
  readonly connecting = signal(false);
  private config: SignupLaunchConfig | null = null;
  private sdk: Sdk | null = null;
  private preparedFor: Id | null = null;

  /** Once per company: whether the button is offered, with Meta's SDK loaded ahead of the click. */
  async prepare(tenantId: Id): Promise<void> {
    if (!this.remote || !tenantId || this.preparedFor === tenantId) return;
    this.preparedFor = tenantId;
    this.state.set('loading');
    try {
      const launch = await this.remote.signupLaunch(tenantId);
      if (!launch.available) return this.state.set('unavailable');
      this.config = { appId: launch.appId, configId: launch.configId, graphVersion: launch.graphVersion };
      this.sdk = await this.meta.prepare(this.config);
      this.state.set('ready');
    } catch {
      // Meta's SDK blocked (an ad blocker) or the server unreachable: the support text shows instead.
      this.preparedFor = null;
      this.state.set('unavailable');
    }
  }

  /** Call straight from the click: Meta's window must open inside it. */
  connect(tenantId: Id): Promise<ConnectResult> {
    const { remote, sdk, config } = this;
    if (!remote || !sdk || !config || this.connecting()) return Promise.resolve({ kind: 'cancelled' });
    this.connecting.set(true);
    return this.meta
      .run(sdk, config)
      .then(async (outcome): Promise<ConnectResult> => {
        if (outcome.kind !== 'done') return outcome;
        const result = await remote.connectSignup(tenantId, { code: outcome.code, wabaId: outcome.wabaId, phoneNumberId: outcome.phoneNumberId });
        // The new number shows at once in this screen, the inbox and the filters.
        await this.remoteSession.loadCompany(tenantId);
        return { kind: 'connected', result, wabaId: outcome.wabaId };
      })
      .catch((error: unknown): ConnectResult => ({ kind: 'error', message: toApiFailure(error).message }))
      .finally(() => this.connecting.set(false));
  }
}
