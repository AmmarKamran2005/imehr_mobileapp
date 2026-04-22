import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { LoggerService } from '../logger/logger.service';

/**
 * Unified storage wrapper.
 * - On native platforms, sensitive values (token, refreshToken) land in the
 *   iOS Keychain / Android Keystore via @capawesome/capacitor-secure-storage.
 * - On the web (dev/PWA), we fall back to Capacitor Preferences (localStorage-backed).
 *   Web is not shipped to patients — Angular dev only.
 *
 * Keys we care about:
 *   auth:token          — JWT
 *   auth:refreshToken   — opaque refresh token
 *   auth:tokenExpiry    — ISO datetime
 *   auth:user           — CurrentUser JSON
 *   prefs:biometric     — '1' | '0' (user opted in?)
 *   prefs:theme         — 'light' | 'dark' | 'auto'
 *   prefs:deviceId      — stable UUID for trust-device flow
 */
@Injectable({ providedIn: 'root' })
export class SecureStorageService {
  private readonly log = inject(LoggerService);
  private readonly isNative = Capacitor.isNativePlatform();

  /** Secure channel — use for tokens + user profile. */
  async setSecure(key: string, value: string): Promise<void> {
    try {
      if (this.isNative) {
        await SecureStorage.set(key, value);
      } else {
        await Preferences.set({ key: this.secureKey(key), value });
      }
    } catch (e) {
      this.log.warn('SecureStorage', `set failed for ${key}`, e);
    }
  }

  async getSecure(key: string): Promise<string | null> {
    try {
      if (this.isNative) {
        const r = await SecureStorage.get(key);
        return (typeof r === 'string') ? r : null;
      }
      const r = await Preferences.get({ key: this.secureKey(key) });
      return r.value ?? null;
    } catch (e) {
      this.log.warn('SecureStorage', `get failed for ${key}`, e);
      return null;
    }
  }

  async removeSecure(key: string): Promise<void> {
    try {
      if (this.isNative) {
        await SecureStorage.remove(key);
      } else {
        await Preferences.remove({ key: this.secureKey(key) });
      }
    } catch (e) {
      this.log.warn('SecureStorage', `remove failed for ${key}`, e);
    }
  }

  /** Non-secure preferences — theme, UI flags, etc. */
  async setPref(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async getPref(key: string): Promise<string | null> {
    const r = await Preferences.get({ key });
    return r.value ?? null;
  }

  async removePref(key: string): Promise<void> {
    await Preferences.remove({ key });
  }

  /** JSON helpers. */
  async setSecureJSON<T>(key: string, value: T): Promise<void> {
    await this.setSecure(key, JSON.stringify(value));
  }

  async getSecureJSON<T>(key: string): Promise<T | null> {
    const raw = await this.getSecure(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; }
    catch { this.log.warn('SecureStorage', `bad JSON for ${key}`); return null; }
  }

  /** Clear all auth keys on logout. */
  async clearAuth(): Promise<void> {
    await Promise.all([
      this.removeSecure('auth:token'),
      this.removeSecure('auth:refreshToken'),
      this.removeSecure('auth:tokenExpiry'),
      this.removeSecure('auth:user'),
    ]);
  }

  private secureKey(k: string): string {
    // Web fallback only — prefixed so it's obvious at rest.
    return 'sec__' + k;
  }
}
