import { provideHttpClient } from '@angular/common/http';
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { BrandTitleStrategy } from './core/brand-title-strategy';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    // Route params and route data arrive as component inputs (conversationId, title, mockup).
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useClass: BrandTitleStrategy },
  ],
};
