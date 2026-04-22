import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { SecureStorageService } from '../storage/secure-storage.service';
import { LoggerService } from '../logger/logger.service';
import { InactivityService } from './inactivity.service';
import { CurrentUser } from '../models/user.model';
import {
  LoginRequest, LoginResponse,
  VerifyOtpRequest, VerifyOtpResponse,
  ResendOtpRequest,
  RefreshRequest, RefreshResponse,
  StoredAuth,
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

  // Reactive state
  readonly user = signal<CurrentUser | null>(null);
  readonly token = signal<string | null>(null);
  private readonly refreshToken = signal<string | null>(null);
  private readonly tokenExpiry = signal<Date | null>(null);

  readonly isAuthenticated = computed(() => !!this.token() && !!this.user());
  readonly currentRole = computed(() => this.user()?.role ?? null);

  // Pending login (between /login and /verify-otp)
  private pendingEmail: string | null = null;
  private pendingChallenge: string | null = null;
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

    this.user.set(stored.user);
    this.token.set(token);
    this.refreshToken.set(refresh);
    this.tokenExpiry.set(expiry ? new Date(expiry) : null);

    this.log.info('Auth', 'session restored', { user: stored.user.email });
    this.inactivity.start(() => this.logout(true));
  }

  /* ============================================================
     Login flow
     ============================================================ */
  async login(email: string, password: string, rememberDevice: boolean): Promise<LoginResponse> {
    const body: LoginRequest = { email, password, rememberDevice };
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${this.api}/api/auth/login`, body),
    );

    if (res.requiresOtpVerification) {
      this.pendingEmail = email;
      this.pendingChallenge = res.otpChallenge ?? null;
      this.pendingRemember = rememberDevice;
      this.log.info('Auth', 'OTP required for', email);
    } else if (res.token && res.refreshToken && res.user) {
      await this.applySession({
        token: res.token,
        refreshToken: res.refreshToken,
        tokenExpiry: res.tokenExpiry ?? '',
        user: res.user,
      });
      this.log.info('Auth', 'login success (trusted device)', email);
    }

    return res;
  }

  async verifyOtp(code: string): Promise<CurrentUser> {
    if (!this.pendingEmail) throw new Error('No pending login for OTP');
    const body: VerifyOtpRequest = {
      email: this.pendingEmail,
      code,
      otpChallenge: this.pendingChallenge ?? undefined,
      rememberDevice: this.pendingRemember,
    };
    const res = await firstValueFrom(
      this.http.post<VerifyOtpResponse>(`${this.api}/api/auth/verify-otp`, body),
    );
    await this.applySession({
      token: res.token,
      refreshToken: res.refreshToken,
      tokenExpiry: res.tokenExpiry,
      user: res.user,
    });
    this.pendingEmail = null;
    this.pendingChallenge = null;
    this.log.info('Auth', 'OTP verified', res.user.email);
    return res.user;
  }

  async resendOtp(): Promise<void> {
    if (!this.pendingEmail) throw new Error('No pending login');
    const body: ResendOtpRequest = {
      email: this.pendingEmail,
      otpChallenge: this.pendingChallenge ?? undefined,
    };
    await firstValueFrom(this.http.post<void>(`${this.api}/api/auth/resend-otp`, body));
    this.log.info('Auth', 'OTP resent', this.pendingEmail);
  }

  /* ============================================================
     Logout
     ============================================================ */
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

    this.inactivity.start(() => this.logout(true));
  }
}
