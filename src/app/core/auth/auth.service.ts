import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { SecureStorageService } from '../storage/secure-storage.service';
import { LoggerService } from '../logger/logger.service';
import { InactivityService } from './inactivity.service';
import { BiometricService } from './biometric.service';
import { CurrentUser } from '../models/user.model';
import {
  LoginRequest, LoginResponse,
  VerifyOtpRequest, VerifyOtpResponse,
  ResendOtpRequest,
  RefreshRequest, RefreshResponse,
  StoredAuth, toCurrentUser,
} from '../models/auth.dto';

/**
 * Central authentication state + transport.
 *
 * Source of truth is Angular signals. Tokens are persisted in SecureStorage
 * (Keychain/Keystore on native) so they survive cold starts and reboots.
 *
 * Public surface used by pages:
 *   login(email, password, rememberDevice)  → LoginResponse
 *   verifyOtp(code)                         → user is now fully authenticated
 *   resendOtp()
 *   logout()
 *   restoreSession()      (called at bootstrap by APP_INITIALIZER)
 *   refreshIfNeeded()     (called by auth interceptor before each request)
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly storage = inject(SecureStorageService);
  private readonly log = inject(LoggerService);
  private readonly inactivity = inject(InactivityService);
  private readonly bio = inject(BiometricService);

  // Reactive state
  readonly user = signal<CurrentUser | null>(null);
  readonly token = signal<string | null>(null);
  private readonly refreshToken = signal<string | null>(null);
  private readonly tokenExpiry = signal<Date | null>(null);

  readonly isAuthenticated = computed(() => !!this.token() && !!this.user());
  readonly currentRole = computed(() => this.user()?.role ?? null);

  // Pending login (between /login and /verify-otp)
  private pendingEmail: string | null = null;
  private pendingRemember = false;

  private refreshInFlight: Promise<boolean> | null = null;

  private readonly api = environment.apiBaseUrl;

  /* ============================================================
     Bootstrap — called from APP_INITIALIZER
     ============================================================ */
  async restoreSession(): Promise<void> {
    const stored = await this.storage.getSecureJSON<StoredAuth>('auth:user');
    const token = await this.storage.getSecure('auth:token');
    const refresh = await this.storage.getSecure('auth:refreshToken');
    const expiry = await this.storage.getSecure('auth:tokenExpiry');

    if (!stored || !token || !refresh) {
      this.log.info('Auth', 'no stored session');
      return;
    }

    // If the user opted into biometric, DO NOT auto-populate — force every
    // cold start through the Login page's biometric card so the device
    // owner has to re-authenticate. HIPAA-friendly and matches banking
    // apps (Chase, PayPal, MyChart). The tokens stay in SecureStorage so
    // the biometric quick-login flow can refresh without a password step.
    if (await this.bio.isEnabledByUser()) {
      this.log.info('Auth', 'session pending biometric unlock');
      return;
    }

    this.user.set(stored.user);
    this.token.set(token);
    this.refreshToken.set(refresh);
    this.tokenExpiry.set(expiry ? new Date(expiry) : null);

    this.log.info('Auth', 'session restored', { user: stored.user.email });
    this.inactivity.start(() => this.softLogout());
  }

  /* ============================================================
     Biometric quick-login — shown on the Login page whenever the
     user has biometric enabled and a refresh token sitting in
     SecureStorage.
     ============================================================ */

  /**
   * True when the Login page should render the "Unlock with Face ID /
   * Fingerprint" card. Reads from SecureStorage directly because the
   * signals are intentionally empty before unlock.
   */
  async hasBiometricUnlockAvailable(): Promise<boolean> {
    if (!(await this.bio.isEnabledByUser())) return false;
    const refresh = await this.storage.getSecure('auth:refreshToken');
    const user = await this.storage.getSecureJSON<StoredAuth>('auth:user');
    return !!refresh && !!user;
  }

  /**
   * Prompts biometric → refreshes the access token → populates signals.
   * Returns a narrow result so the Login page can react appropriately:
   *   - 'ok'          → session is live, navigate to /tabs/home
   *   - 'cancelled'   → user tapped cancel; leave the page as-is
   *   - 'unavailable' → flag off / no stored refresh token; hide card
   *   - 'expired'     → refresh call failed (revoked / expired); wipe and
   *                     ask for password
   *   - 'error'       → other failure; toast and allow retry
   */
  async biometricQuickLogin(): Promise<'ok' | 'cancelled' | 'unavailable' | 'expired' | 'error'> {
    if (!(await this.hasBiometricUnlockAvailable())) return 'unavailable';

    const ok = await this.bio.authenticate('Unlock IMEHR');
    if (!ok) return 'cancelled';

    try {
      const stored  = await this.storage.getSecureJSON<StoredAuth>('auth:user');
      const refresh = await this.storage.getSecure('auth:refreshToken');
      const token   = await this.storage.getSecure('auth:token');
      const expiry  = await this.storage.getSecure('auth:tokenExpiry');
      if (!stored || !refresh) return 'unavailable';

      // Seed signals so the interceptor has a refresh token on hand.
      // Force a refresh by marking the access token as expired.
      this.user.set(stored.user);
      this.token.set(token ?? '');
      this.refreshToken.set(refresh);
      this.tokenExpiry.set(expiry ? new Date(expiry) : new Date(Date.now() - 60_000));

      const refreshed = await this.doRefresh();
      if (!refreshed) {
        // doRefresh already called `logout(true)` for us — just surface it.
        return 'expired';
      }

      this.inactivity.start(() => this.softLogout());
      this.log.info('Auth', 'biometric unlock succeeded', stored.user.email);
      return 'ok';
    } catch (e) {
      this.log.warn('Auth', 'biometricQuickLogin error', e);
      return 'error';
    }
  }

  /* ============================================================
     Login flow
     ============================================================ */
  async login(email: string, password: string, rememberDevice: boolean): Promise<LoginResponse> {
    const body: LoginRequest = { email, password };
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${this.api}/api/auth/login`, body),
    );

    // Keep the remember-device choice for the OTP step where the server
    // actually consumes it (sets the __medocs_dt cookie on verify-otp).
    this.pendingEmail = email;
    this.pendingRemember = rememberDevice;

    if (res.requiresOtpVerification) {
      this.log.info('Auth', 'OTP required for', email);
    } else if (res.token && res.refreshToken) {
      // Trusted device path — identity fields are flat on the response.
      await this.applySession({
        token: res.token,
        refreshToken: res.refreshToken,
        tokenExpiry: res.tokenExpiry ?? '',
        user: toCurrentUser(res),
      });
      this.pendingEmail = null;
      this.log.info('Auth', 'login success (trusted device)', email);
    }

    return res;
  }

  async verifyOtp(code: string): Promise<CurrentUser> {
    if (!this.pendingEmail) throw new Error('No pending login for OTP');
    const body: VerifyOtpRequest = {
      email: this.pendingEmail,
      otpCode: code,
      rememberDevice: this.pendingRemember,
    };
    const res = await firstValueFrom(
      this.http.post<VerifyOtpResponse>(`${this.api}/api/auth/verify-otp`, body),
    );
    const user = toCurrentUser(res);
    await this.applySession({
      token: res.token,
      refreshToken: res.refreshToken ?? '',
      tokenExpiry: res.tokenExpiry ?? '',
      user,
    });
    this.pendingEmail = null;
    this.log.info('Auth', 'OTP verified', user.email);
    return user;
  }

  async resendOtp(): Promise<void> {
    if (!this.pendingEmail) throw new Error('No pending login');
    const body: ResendOtpRequest = { email: this.pendingEmail };
    await firstValueFrom(this.http.post<void>(`${this.api}/api/auth/resend-otp`, body));
    this.log.info('Auth', 'OTP resent', this.pendingEmail);
  }

  /* ============================================================
     Logout
     ============================================================ */

  /**
   * Hard logout — used by the "Log out" button in the More tab and by
   * `doRefresh` when the server revokes the refresh token. Clears
   * everything from SecureStorage; the user must go through the full
   * password + OTP flow next time. The biometric-enabled flag is left
   * in Preferences as a device preference.
   */
  async logout(silent = false): Promise<void> {
    const t = this.token();
    try {
      if (t) {
        await firstValueFrom(this.http.post<void>(`${this.api}/api/auth/logout`, {}));
      }
    } catch (e) {
      this.log.warn('Auth', 'server logout failed (continuing)', e);
    }

    await this.storage.clearAuth();
    this.user.set(null);
    this.token.set(null);
    this.refreshToken.set(null);
    this.tokenExpiry.set(null);
    this.inactivity.stop();

    if (!silent) {
      void this.router.navigate(['/login']);
    } else {
      // idle expiry — still route, but without a user-initiated toast
      void this.router.navigate(['/login'], { queryParams: { expired: 1 } });
    }
  }

  /**
   * Soft logout — clears the access token + in-memory signals so route
   * guards deny entry, but intentionally LEAVES the refresh token and
   * user profile in SecureStorage so the biometric quick-login card on
   * the Login page can get the user back in with a single biometric
   * tap. Fired by the InactivityService when the 15-min HIPAA idle
   * window elapses.
   */
  async softLogout(): Promise<void> {
    await this.storage.removeSecure('auth:token');
    await this.storage.removeSecure('auth:tokenExpiry');
    this.user.set(null);
    this.token.set(null);
    this.refreshToken.set(null);
    this.tokenExpiry.set(null);
    this.inactivity.stop();
    void this.router.navigate(['/login'], { queryParams: { expired: 1 } });
  }

  /* ============================================================
     Refresh
     ============================================================ */
  /** Returns true if token is still valid (or was refreshed). False → caller should abort. */
  async refreshIfNeeded(): Promise<boolean> {
    const t = this.token();
    const exp = this.tokenExpiry();
    if (!t) return false;
    if (!exp) return true; // no expiry claim; trust it

    const msLeft = exp.getTime() - Date.now();
    if (msLeft > environment.tokenRefreshThresholdMs) return true;

    // collapse concurrent refresh attempts
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.doRefresh().finally(() => (this.refreshInFlight = null));
    return this.refreshInFlight;
  }

  private async doRefresh(): Promise<boolean> {
    const rt = this.refreshToken();
    if (!rt) return false;
    try {
      const body: RefreshRequest = { refreshToken: rt };
      const res = await firstValueFrom(
        this.http.post<RefreshResponse>(`${this.api}/api/auth/refresh`, body),
      );
      this.token.set(res.token);
      this.refreshToken.set(res.refreshToken);
      this.tokenExpiry.set(new Date(res.tokenExpiry));
      await this.storage.setSecure('auth:token', res.token);
      await this.storage.setSecure('auth:refreshToken', res.refreshToken);
      await this.storage.setSecure('auth:tokenExpiry', res.tokenExpiry);
      this.log.info('Auth', 'token refreshed');
      return true;
    } catch (e) {
      this.log.warn('Auth', 'refresh failed → logging out', e);
      await this.logout(true);
      return false;
    }
  }

  /* ============================================================
     Internal
     ============================================================ */
  private async applySession(s: StoredAuth): Promise<void> {
    this.user.set(s.user);
    this.token.set(s.token);
    this.refreshToken.set(s.refreshToken);
    this.tokenExpiry.set(s.tokenExpiry ? new Date(s.tokenExpiry) : null);

    await this.storage.setSecure('auth:token', s.token);
    await this.storage.setSecure('auth:refreshToken', s.refreshToken);
    if (s.tokenExpiry) await this.storage.setSecure('auth:tokenExpiry', s.tokenExpiry);
    await this.storage.setSecureJSON('auth:user', s);

    // Idle logout is SOFT so the biometric card can bring the user back
    // without a full password + OTP round. A full logout remains available
    // via the "Log out" button in More.
    this.inactivity.start(() => this.softLogout());
  }
}
