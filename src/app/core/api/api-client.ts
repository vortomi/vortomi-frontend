import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, firstValueFrom } from 'rxjs';
import type { Id } from '../../shared/api/models';
import { API_CONFIG } from './api-config';
import { toApiFailure } from './api-error';

export type QueryValue = string | number | boolean | null | undefined;

/**
 * Thin client for vortomi-backend. Paths are relative to the API base; company paths
 * go through company(). Every failure comes out as an ApiFailure with its Spanish
 * message (error-messages.ts); the session token is added by authInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  /** Full URL of an API path, for httpResource and similar. */
  url(path: string, query?: Record<string, QueryValue>): string {
    const base = this.config.baseUrl.replace(/\/+$/, '');
    const params = toParams(query).toString();
    return `${base}/${path.replace(/^\/+/, '')}${params ? `?${params}` : ''}`;
  }

  /** Path of a company-scoped resource: tenants/:tenantId/<path>. */
  company(tenantId: Id, path: string): string {
    return `tenants/${encodeURIComponent(tenantId)}/${path.replace(/^\/+/, '')}`;
  }

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.run(this.http.get<T>(this.url(path, query)));
  }

  post<T>(path: string, body: unknown = {}): Promise<T> {
    return this.run(this.http.post<T>(this.url(path), body));
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.run(this.http.put<T>(this.url(path), body));
  }

  delete<T = void>(path: string): Promise<T> {
    return this.run(this.http.delete<T>(this.url(path)));
  }

  private async run<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiFailure(error);
    }
  }
}

/** Drops empty values so optional filters never reach the server as "undefined". */
function toParams(query: Record<string, QueryValue> | undefined): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  }
  return params;
}
