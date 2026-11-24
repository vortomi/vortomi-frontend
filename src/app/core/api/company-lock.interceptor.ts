import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { CompanyLock } from '../company-lock';

const COMPANY_PATH = /\/tenants\/([^/?#]+)\//;

/** The company a call was about, from its path (tenants/:tenantId/...). */
export function tenantOfUrl(url: string): string | null {
  const match = COMPANY_PATH.exec(url);
  return match ? decodeURIComponent(match[1]!) : null;
}

/**
 * Notes a company the server locked out for not paying (403 company_unpaid), so the panel shows
 * its lock screen instead of a broken page. The error still reaches the caller.
 */
export const companyLockInterceptor: HttpInterceptorFn = (request, next) => {
  const lock = inject(CompanyLock);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 403 && (error.error as { error?: unknown } | null)?.error === 'company_unpaid') {
        const tenantId = tenantOfUrl(request.url);
        if (tenantId) lock.markUnpaid(tenantId);
      }
      return throwError(() => error);
    }),
  );
};
