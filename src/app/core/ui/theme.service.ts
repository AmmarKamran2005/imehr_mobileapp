import { Injectable, inject, signal } from '@angular/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { SecureStorageService } from '../storage/secure-storage.service';
import { LoggerService } from '../logger/logger.service';

export type ThemePref = 'light' | 'dark' | 'auto';

/**
 * Theme manager. Applies body classes consumed by variables.scss and
 * syncs the native status bar color. Persists user choice via Preferences.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(SecureStorageService);
  private readonly log = inject(LoggerService);

  readonly pref = signal<ThemePref>('auto');
  readonly effective = signal<'light' | 'dark'>('light');

  async init(): Promise<void> {
    const saved = (await this.storage.getPref('prefs:theme')) as ThemePref | null;
    const p: ThemePref = saved ?? 'auto';
    await this.apply(p);

    // Follow system when in auto mode
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', () => {
        if (this.pref() === 'auto') this.applyClasses('auto');
      });
    }
  }

  async set(p: ThemePref): Promise<void> {
    await this.storage.setPref('prefs:theme', p);
    await this.apply(p);
  }

  private async apply(p: ThemePref): Promise<void> {
    this.pref.set(p);
    this.applyClasses(p);
    await this.syncStatusBar();
  }

  private applyClasses(p: ThemePref): void {
    const body = document.body;
    body.classList.remove('dark-theme', 'auto-theme');

    const sysDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const eff: 'light' | 'dark' =
      p === 'dark' ? 'dark' :
      p === 'light' ? 'light' :
      (sysDark ? 'dark' : 'light');

    if (p === 'auto') body.classList.add('auto-theme');
    if (eff === 'dark') body.classList.add('dark-theme');
    this.effective.set(eff);
  }

  private async syncStatusBar(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.setStyle({
        style: this.effective() === 'dark' ? Style.Dark : Style.Light,
      });
    } catch (e) {
      this.log.warn('Theme', 'status bar sync failed', e);
    }
  }
}
