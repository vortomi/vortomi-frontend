import { Injectable } from '@angular/core';

/** What the panel needs to open Meta's window (public values from the server). */
export interface SignupLaunchConfig {
  appId: string;
  configId: string;
  graphVersion: string;
}

/** How Meta's window ended. `done` carries what the server needs; the code lives 30 seconds. */
export type SignupOutcome =
  | { kind: 'done'; code: string; wabaId: string; phoneNumberId: string }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

interface LoginResponse {
  authResponse?: { code?: string } | null;
}

interface FacebookSdk {
  init(options: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
  login(callback: (response: LoginResponse) => void, options: object): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_URL = 'https://connect.facebook.net/es_LA/sdk.js';
/** After the login answers, how long the window's account and number may take to arrive. */
const SESSION_WAIT_MS = 5_000;
const REUSED_LOGIN =
  'Meta usó tu conexión anterior y no te dejó elegir el número. Pulsa otra vez y, en la ventana de Meta, elige «Editar configuración» en vez de «Continuar».';

/** Only Meta's own pages may tell us how the window ended. */
function fromFacebook(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'https:' && (hostname === 'facebook.com' || hostname.endsWith('.facebook.com'));
  } catch {
    return false;
  }
}

/** The window's message, when it is one of Embedded Signup's. */
function signupEvent(raw: unknown): { event: string; data: Record<string, unknown> } | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== 'object' || value === null) return null;
  const message = value as { type?: unknown; event?: unknown; data?: unknown };
  if (message.type !== 'WA_EMBEDDED_SIGNUP' || typeof message.event !== 'string') return null;
  return { event: message.event, data: typeof message.data === 'object' && message.data !== null ? (message.data as Record<string, unknown>) : {} };
}

const digits = (value: unknown): string | null => (typeof value === 'string' && /^\d{5,25}$/.test(value) ? value : null);

/**
 * Meta's «Conectar WhatsApp» window (Embedded Signup v4, with the WhatsApp Business app number
 * option). Browser side only: loads Meta's SDK, opens the window and hands back the code and the
 * account and number chosen. The code is exchanged by the server, never here.
 */
@Injectable({ providedIn: 'root' })
export class MetaSignup {
  private sdk: Promise<FacebookSdk> | null = null;

  /**
   * Loads the SDK ahead of the click: the window must open in the click itself, or the browser
   * blocks it as a pop-up.
   */
  prepare(config: SignupLaunchConfig): Promise<FacebookSdk> {
    this.sdk ??= new Promise<FacebookSdk>((resolve, reject) => {
      window.fbAsyncInit = () => {
        const fb = window.FB;
        if (!fb) return reject(new Error('Facebook SDK missing'));
        fb.init({ appId: config.appId, autoLogAppEvents: true, xfbml: true, version: config.graphVersion });
        resolve(fb);
      };
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () => {
        this.sdk = null;
        reject(new Error('Facebook SDK could not load'));
      };
      document.body.appendChild(script);
    });
    return this.sdk;
  }

  /** Opens the window. Call it straight from the click, after prepare() resolved. */
  run(fb: FacebookSdk, config: SignupLaunchConfig): Promise<SignupOutcome> {
    return new Promise((resolve) => {
      let session: { wabaId: string; phoneNumberId: string } | null = null;
      let ended: SignupOutcome | null = null;
      let code: string | null = null;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const finish = (outcome: SignupOutcome) => {
        window.removeEventListener('message', onMessage);
        clearTimeout(timer);
        resolve(outcome);
      };
      const settle = () => {
        if (code && session) finish({ kind: 'done', code, ...session });
      };
      const onMessage = (event: MessageEvent) => {
        if (!fromFacebook(event.origin)) return;
        const message = signupEvent(event.data);
        if (!message) return;
        if (message.event.startsWith('FINISH')) {
          const wabaId = digits(message.data['waba_id']);
          const phoneNumberId = digits(message.data['phone_number_id']);
          if (wabaId && phoneNumberId) session = { wabaId, phoneNumberId };
          else ended = { kind: 'error', message: 'Meta no indicó qué número elegiste. Vuelve a intentarlo.' };
        } else if (message.event === 'CANCEL') {
          ended = { kind: 'cancelled' };
        } else if (message.event === 'ERROR') {
          const detail = message.data['error_message'];
          ended = { kind: 'error', message: typeof detail === 'string' && detail ? `Meta respondió: ${detail}` : 'Meta no pudo completar la conexión.' };
        }
        settle();
      };
      window.addEventListener('message', onMessage);

      fb.login(
        (response) => {
          code = response.authResponse?.code ?? null;
          if (!code) return finish(ended ?? { kind: 'cancelled' });
          settle();
          // The account and number come in a separate message; usually before this answer. A login
          // without it is Meta reusing an earlier sign-in («Continuar como…») and skipping WhatsApp's steps.
          timer = setTimeout(() => finish(ended ?? { kind: 'error', message: REUSED_LOGIN }), SESSION_WAIT_MS);
        },
        {
          config_id: config.configId,
          response_type: 'code',
          override_default_response_type: true,
          // Offers connecting the number the owner already uses on the WhatsApp Business app.
          extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
        },
      );
    });
  }
}
