import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { LoggerService } from '../logger/logger.service';
import { ToastService } from '../ui/toast.service';
import { AuthService } from '../auth/auth.service';

/**
 * Central HTTP error handling. Maps status codes to user-facing behavior.
 * Prior project (rehabdox) had NO error interceptor — every feature
 * handled errors ad-hoc and many silently ignored failures. Not us.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const log = inject(LoggerService);
  const toasts = inject(ToastService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err instanceof HttpErrorResponse) {
        const msg = extractMsg(err);
        log.warn('Http', `${err.status} ${req.method} ${req.url}`, msg);

        switch (err.status) {
          case 0:
            void toasts.warn('Network unavailable. Check your connection.');
            break;
          case 401:
            // Only force logout if it's not the login/OTP call itself
            if (!req.url.includes('/api/auth/login') && !req.url.includes('/api/auth/verify-otp')) {
              void auth.logout(true);
            }
            break;
          case 403:
            void toasts.error('You do not have access to perform this action.');
            break;
          case 404:
            // leave to caller (many 404s are legitimate empty states)
            break;
          case 409:
            void toasts.warn(msg || 'Conflict — please refresh and try again.');
            break;
          case 422:
          case 400:
            // validation — caller shows inline, no global toast
            break;
          case 429:
            void toasts.warn('Too many requests. Please wait a moment.');
            break;
          default:
            if (err.status >= 500) {
              void toasts.error('Server error. Try again in a few seconds.');
            }
        }
      }
      return throwError(() => err);
    }),
  );
};

function extractMsg(err: HttpErrorResponse): string {
  if (typeof err.error === 'string') return err.error;
  if (err.error && typeof err.error === 'object') {
    const e = err.error as Record<string, unknown>;
    if (typeof e['message'] === 'string') return e['message'] as string;
    if (typeof e['title'] === 'string')   return e['title']   as string;
    if (typeof e['error']   === 'string') return e['error']   as string;
  }
  return err.message;
}
