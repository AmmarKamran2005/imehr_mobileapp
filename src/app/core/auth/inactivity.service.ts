import { Injectable, inject, NgZone } from '@angular/core';
import { App } from '@capacitor/app';
import { environment } from 'src/environments/environment';
import { LoggerService } from '../logger/logger.service';

/**
 * HIPAA-mandated idle-logout.
 * - 15 min of no user activity → emits `onExpire` which the AuthService uses to log out.
 * - User activity = touch, keydown, click. Throttled to one event per 30s
 *   (emitting every 30s is fine; resetting the timer every tap would be chatty).
 * - If the app goes to background for longer than the window, we also expire on resume.
 */
@Injectable({ providedIn: 'root' })
export class InactivityService {
  private readonly zone = inject(NgZone);
  private readonly log = inject(LoggerService);

  private timer: number | null = null;
  private lastActivity = Date.now();
  private onExpire: (() => void) | null = null;
  private started = false;

  /** Register global DOM listeners once at app boot. */
  init(): void {
    if (this.started) return;
    this.started = true;

    // Run listeners outside Angular zone to avoid triggering change detection on every tap.
    this.zone.runOutsideAngular(() => {
      const onAct = () => this.markActivity();
      ['touchstart', 'mousedown', 'keydown', 'wheel', 'scroll'].forEach((ev) =>
        document.addEventListener(ev, onAct, { passive: true }),
      );

      // App lifecycle: check elapsed on resume
      App.addListener('appStateChange', (s) => {
        if (s.isActive) this.checkElapsedOnResume();
      });
    });
  }

  /** Only the auth flow should wire this — when user is logged in. */
  start(onExpire: () => void): void {
    this.onExpire = onExpire;
    this.markActivity();
    this.schedule();
    this.log.debug('Inactivity', 'timer started');
  }

  stop(): void {
    this.onExpire = null;
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.log.debug('Inactivity', 'timer stopped');
  }

  private markActivity(): void {
    const now = Date.now();
    if (now - this.lastActivity < environment.activityThrottleMs) return;
    this.lastActivity = now;
    this.schedule();
  }

  private schedule(): void {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.fire(), environment.inactivityTimeoutMs);
  }

  private fire(): void {
    this.log.info('Inactivity', 'idle logout triggered');
    this.zone.run(() => this.onExpire?.());
  }

  private checkElapsedOnResume(): void {
    const elapsed = Date.now() - this.lastActivity;
    if (elapsed >= environment.inactivityTimeoutMs) {
      this.fire();
    } else {
      this.schedule();
    }
  }
}
