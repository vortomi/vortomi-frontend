import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from './api-client';
import { provideApiConfig } from './api-config';
import { ApiFailure } from './api-error';
import { AccessTokenSource } from './access-token';
import { authInterceptor, isApiUrl } from './auth.interceptor';

class FixedToken extends AccessTokenSource {
  constructor(private readonly value: string | null) {
    super();
  }
  override token(): Promise<string | null> {
    return Promise.resolve(this.value);
  }
}

function setup(token: string | null = 'session-token') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideApiConfig({ mode: 'api', baseUrl: '/api', supabase: null }),
      { provide: AccessTokenSource, useValue: new FixedToken(token) },
    ],
  });
  return { api: TestBed.inject(ApiClient), http: TestBed.inject(HttpTestingController) };
}

/** The interceptor awaits the token before the request leaves: let that settle first. */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve));

describe('ApiClient', () => {
  it('builds company paths and drops empty filters', () => {
    const { api } = setup();
    expect(api.url(api.company('t-1', 'conversations'), { view: 'mine', tagId: undefined, search: '' })).toBe(
      '/api/tenants/t-1/conversations?view=mine',
    );
  });

  it('sends the session token to our API', async () => {
    const { api, http } = setup();
    const answer = api.get<{ ok: boolean }>('me');
    await flushMicrotasks();
    const request = http.expectOne('/api/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    request.flush({ ok: true });
    expect(await answer).toEqual({ ok: true });
  });

  it('never sends it anywhere else', async () => {
    const { http } = setup();
    // A plain call to the prototype's data goes through the same interceptor chain.
    TestBed.inject(HttpClient).get('/data/tenants.json').subscribe();
    await flushMicrotasks();
    expect(http.expectOne('/data/tenants.json').request.headers.has('Authorization')).toBe(false);
  });

  it('turns the server error code into a Spanish message', async () => {
    const { api, http } = setup();
    const answer = api.post('tenants/t-1/conversations/c-1/messages', { body: 'Hola' });
    await flushMicrotasks();
    http.expectOne('/api/tenants/t-1/conversations/c-1/messages').flush({ error: 'service_window_closed' }, { status: 422, statusText: 'Unprocessable' });
    const failure = await answer.catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect(failure).toMatchObject({ status: 422, code: 'service_window_closed' });
    expect((failure as ApiFailure).message).toContain('24 horas');
  });

  it('marks an expired session so the panel can send the person to sign in', async () => {
    const { api, http } = setup();
    const answer = api.get('me');
    await flushMicrotasks();
    http.expectOne('/api/me').flush({ error: 'invalid_token' }, { status: 401, statusText: 'Unauthorized' });
    expect(((await answer.catch((error: unknown) => error)) as ApiFailure).needsSignIn).toBe(true);
  });

  it('explains a network failure', async () => {
    const { api, http } = setup();
    const answer = api.get('me');
    await flushMicrotasks();
    http.expectOne('/api/me').error(new ProgressEvent('error'));
    expect(await answer.catch((error: unknown) => error)).toMatchObject({ status: 0, code: 'network' });
  });

  it('goes without a token when nobody is signed in', async () => {
    const { api, http } = setup(null);
    void api.get('me').catch(() => undefined);
    await flushMicrotasks();
    expect(http.expectOne('/api/me').request.headers.has('Authorization')).toBe(false);
  });
});

describe('isApiUrl', () => {
  it('matches the base and its paths only', () => {
    expect(isApiUrl('/api/me', '/api')).toBe(true);
    expect(isApiUrl('/api', '/api/')).toBe(true);
    expect(isApiUrl('/apis/me', '/api')).toBe(false);
    expect(isApiUrl('/data/tenants.json', '/api')).toBe(false);
    expect(isApiUrl('https://evil.example/api/me', '/api')).toBe(false);
  });
});
