import { MetaSignup, type SignupLaunchConfig } from './meta-signup';

const CONFIG: SignupLaunchConfig = { appId: '1167128472338629', configId: '3023822601294020', graphVersion: 'v27.0' };

type LoginCallback = (response: { authResponse?: { code?: string } | null }) => void;

/** Stands in for Meta's SDK: records the options and answers the login when the test says. */
function fakeSdk() {
  let answer: LoginCallback | null = null;
  let options: object | null = null;
  return {
    sdk: {
      init: () => undefined,
      login: (callback: LoginCallback, opts: object) => {
        answer = callback;
        options = opts;
      },
    },
    answer: (code: string | null) => answer?.({ authResponse: code ? { code } : null }),
    options: () => options,
  };
}

const post = (data: unknown, origin = 'https://www.facebook.com') => window.dispatchEvent(new MessageEvent('message', { data, origin }));
const finish = (origin?: string) =>
  post(JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', data: { waba_id: '300000000000011', phone_number_id: '400000000000011' } }), origin);

describe('MetaSignup.run', () => {
  it('opens the window for the WhatsApp Business app number and hands back code, account and number', async () => {
    const fb = fakeSdk();
    const running = new MetaSignup().run(fb.sdk, CONFIG);
    expect(fb.options()).toEqual({
      config_id: CONFIG.configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
    });
    finish();
    fb.answer('AQD-code');
    expect(await running).toEqual({ kind: 'done', code: 'AQD-code', wabaId: '300000000000011', phoneNumberId: '400000000000011' });
  });

  it('ignores messages from any page that is not Meta\'s, however it is named', async () => {
    const fb = fakeSdk();
    const running = new MetaSignup().run(fb.sdk, CONFIG);
    finish('https://evilfacebook.com');
    finish('http://www.facebook.com');
    fb.answer('AQD-code');
    post(JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: '../me', phone_number_id: '1' } }));
    finish();
    expect(await running).toMatchObject({ kind: 'done', wabaId: '300000000000011' });
  });

  it('closing the window is a cancel, not an error', async () => {
    const fb = fakeSdk();
    const running = new MetaSignup().run(fb.sdk, CONFIG);
    post({ type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL', data: { current_step: 'PHONE_NUMBER_SETUP' } });
    fb.answer(null);
    expect(await running).toEqual({ kind: 'cancelled' });
  });

  it('says what Meta answered when the window fails', async () => {
    const fb = fakeSdk();
    const running = new MetaSignup().run(fb.sdk, CONFIG);
    post({ type: 'WA_EMBEDDED_SIGNUP', event: 'ERROR', data: { error_message: 'Número no elegible' } });
    fb.answer(null);
    expect(await running).toEqual({ kind: 'error', message: 'Meta respondió: Número no elegible' });
  });
});
