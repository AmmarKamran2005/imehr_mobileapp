import { Injectable, inject } from '@angular/core';
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';
import { Capacitor } from '@capacitor/core';
import { SecureStorageService } from '../storage/secure-storage.service';
import { LoggerService } from '../logger/logger.service';
import { environment } from 'src/environments/environment';

/**
 * Biometric wrapper. Uses @aparajita/capacitor-biometric-auth which supports
 * Face ID / Touch ID on iOS and Fingerprint / Face on Android.
 *
 * The pattern here: after a normal login succeeds, ask the user if they
 * want to enable biometric; if yes, stash a flag in Preferences. On next
 * app launch, if token is missing/expired we prompt for biometric, then
 * refresh the token using the stored refresh token (still in SecureStorage).
 */
@Injectable({ providedIn: 'root' })
export class BiometricService {
  private readonly storage = inject(SecureStorageService);
  private readonly log = inject(LoggerService);

  async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const info = await BiometricAuth.checkBiometry();
      return info.isAvailable;
    } catch (e) {
      this.log.warn('Biometric', 'checkBiometry failed', e);
      return false;
    }
  }

  async biometryType(): Promise<BiometryType | null> {
    if (!Capacitor.isNativePlatform()) return null;
    try {
      const info = await BiometricAuth.checkBiometry();
      return info.biometryType;
    } catch {
      return null;
    }
  }

  async isEnabledByUser(): Promise<boolean> {
    const v = await this.storage.getPref('prefs:biometric');
    return v === '1';
  }

  async setEnabledByUser(enabled: boolean): Promise<void> {
    await this.storage.setPref('prefs:biometric', enabled ? '1' : '0');
  }

  /**
   * Prompt the user with a biometric challenge. Resolves true on success,
   * false on cancel / mismatch / unavailable.
   */
  async authenticate(reason = environment.biometric.reason): Promise<boolean> {
    if (!(await this.isAvailable())) return false;
    try {
      await BiometricAuth.authenticate({
        reason,
        cancelTitle: 'Use password',
        allowDeviceCredential: false,
        iosFallbackTitle: 'Use password',
        androidTitle: 'Sign in to IMEHR',
        androidSubtitle: reason,
        androidConfirmationRequired: false,
      });
      return true;
    } catch (e) {
      this.log.info('Biometric', 'auth cancelled / failed', e);
      return false;
    }
  }
}
