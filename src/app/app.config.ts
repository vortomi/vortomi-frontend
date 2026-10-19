import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { provideApiConfig } from './core/api/api-config';
import { authInterceptor } from './core/api/auth.interceptor';
import { BrandTitleStrategy } from './core/brand-title-strategy';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // The interceptor only touches calls to our API; the prototype's JSON goes untouched.
    provideHttpClient(withInterceptors([authInterceptor])),
    // 'mock' until sign-in with Supabase is connected (documentations/08, phase G).
    provideApiConfig({ mode: 'mock', baseUrl: '/api' }),
    // Route params and route data arrive as component inputs (conversationId, title, mockup).
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useClass: BrandTitleStrategy },
  ],
};
