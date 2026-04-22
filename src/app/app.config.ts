import {
  ApplicationConfig,
  provideZoneChangeDetection,
  inject,
  provideAppInitializer,
} from '@angular/core';
import {
  provideRouter,
  withPreloading,
  PreloadAllModules,
  withInMemoryScrolling,
} from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { loggingInterceptor } from './core/http/logging.interceptor';
import { AuthService } from './core/auth/auth.service';

/**
 * Bootstrap-time hook that asks AuthService to restore any tokens
 * stashed in SecureStorage from a previous session, so the routing
 * decision (login vs. schedule) uses the right auth state.
 */
function initAuth() {
  const auth = inject(AuthService);
  return auth.restoreSession();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideIonicAngular({
      mode: 'md',
      // Keep the status bar readable on Android
      statusTap: false,
      // Allow rubber-band scroll on iOS; no global swipe back (we use router per-page)
    }),

    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
    ),

    provideHttpClient(
      withInterceptors([
        loggingInterceptor,
        authInterceptor,
        errorInterceptor,
      ]),
    ),

    provideAppInitializer(initAuth),
  ],
};
