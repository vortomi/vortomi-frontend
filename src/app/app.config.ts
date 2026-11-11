import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding, withNavigationErrorHandler } from '@angular/router';
import { authInterceptor } from './core/api/auth.interceptor';
import { RUNTIME_CONFIG } from './core/api/runtime-config';
import { BrandTitleStrategy } from './core/brand-title-strategy';
import { reloadOnStaleBuild } from './core/stale-build';
import { provideDataSource } from './core/data-source.providers';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // The interceptor only touches calls to our API; the prototype's JSON goes untouched.
    provideHttpClient(withInterceptors([authInterceptor])),
    // Prototype JSON or vortomi-backend with a Supabase session: core/api/runtime-config.ts.
    provideDataSource(RUNTIME_CONFIG),
    // Route params and route data arrive as component inputs (conversationId, title, mockup).
    // A screen of an older build (tab open across a deploy) reloads onto the new one.
    provideRouter(routes, withComponentInputBinding(), withNavigationErrorHandler(reloadOnStaleBuild)),
    { provide: TitleStrategy, useClass: BrandTitleStrategy },
  ],
};
