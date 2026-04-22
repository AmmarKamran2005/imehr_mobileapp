import { Injectable, inject } from '@angular/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { LoggerService } from '../logger/logger.service';

/**
 * Thin wrapper over Capacitor Haptics — swallows unsupported-platform errors
 * so callers can fire-and-forget.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly log = inject(LoggerService);
  private readonly available = Capacitor.isNativePlatform();

  async light(): Promise<void> {
    if (!this.available) return;
    try { await Haptics.impact({ style: ImpactStyle.Light }); }
    catch (e) { this.log.debug('Haptics', 'light failed', e); }
  }

  async medium(): Promise<void> {
    if (!this.available) return;
    try { await Haptics.impact({ style: ImpactStyle.Medium }); }
    catch (e) { this.log.debug('Haptics', 'medium failed', e); }
  }

  async success(): Promise<void> {
    if (!this.available) return;
    try { await Haptics.notification({ type: NotificationType.Success }); }
    catch (e) { this.log.debug('Haptics', 'success failed', e); }
  }

  async warning(): Promise<void> {
    if (!this.available) return;
    try { await Haptics.notification({ type: NotificationType.Warning }); }
    catch (e) { this.log.debug('Haptics', 'warning failed', e); }
  }

  async error(): Promise<void> {
    if (!this.available) return;
    try { await Haptics.notification({ type: NotificationType.Error }); }
    catch (e) { this.log.debug('Haptics', 'error failed', e); }
  }
}
