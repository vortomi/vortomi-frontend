import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { API_CONFIG } from './api-config';
import { AccessTokenSource } from './access-token';

/**
 * Adds the session's access token to calls to OUR API only. Anything else (the
 * prototype's JSON, third parties) never sees it: a token sent to the wrong host is
 * a leaked session.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const { baseUrl } = inject(API_CONFIG);
  if (!isApiUrl(request.url, baseUrl)) return next(request);
  const tokens = inject(AccessTokenSource);
  return from(tokens.token()).pipe(
    switchMap((token) => next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request)),
  );
};

/** Same base, followed by "/" or the end: "/api" matches "/api/me", never "/apis" or "/data". */
export function isApiUrl(url: string, baseUrl: string): boolean {
  const base = baseUrl.replace(/\/+$/, '');
  return url === base || url.startsWith(`${base}/`);
}
