import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { LoggerService } from '../logger/logger.service';

/**
 * Dev-only request logger. In production (environment.logLevel === 'warn'),
 * LoggerService filters debug/info out so this is effectively a no-op.
 */
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const log = inject(LoggerService);
  const t0 = performance.now();
  log.debug('Http', `→ ${req.method} ${stripBase(req.url)}`);
  return next(req).pipe(
    tap({
      next: (_e) => log.debug('Http', `← ${req.method} ${stripBase(req.url)} (${Math.round(performance.now() - t0)}ms)`),
      error: () => { /* handled by errorInterceptor */ },
    }),
  );
};

function stripBase(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}
