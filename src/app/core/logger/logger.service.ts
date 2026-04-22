import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

type Level = 'debug' | 'info' | 'warn' | 'error' | 'silent';
const LEVEL_ORDER: Record<Level, number> = {
  debug: 10, info: 20, warn: 30, error: 40, silent: 99,
};

/**
 * Central logger. Production-safe — strips debug/info when the
 * environment's configured level is higher. Never commit console.log
 * in feature code — always go through this service.
 *
 * Why: prior EHR companion app (rehabdox) shipped 247 raw console.logs
 * to prod, some leaking token metadata. Not us.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly threshold = LEVEL_ORDER[environment.logLevel];

  debug(scope: string, ...args: unknown[]): void {
    if (this.threshold <= LEVEL_ORDER.debug) {
      // eslint-disable-next-line no-console
      console.debug(this.fmt(scope), ...args);
    }
  }

  info(scope: string, ...args: unknown[]): void {
    if (this.threshold <= LEVEL_ORDER.info) {
      // eslint-disable-next-line no-console
      console.info(this.fmt(scope), ...args);
    }
  }

  warn(scope: string, ...args: unknown[]): void {
    if (this.threshold <= LEVEL_ORDER.warn) {
      // eslint-disable-next-line no-console
      console.warn(this.fmt(scope), ...args);
    }
  }

  error(scope: string, ...args: unknown[]): void {
    if (this.threshold <= LEVEL_ORDER.error) {
      // eslint-disable-next-line no-console
      console.error(this.fmt(scope), ...args);
    }
  }

  private fmt(scope: string): string {
    return `[${scope}]`;
  }
}
