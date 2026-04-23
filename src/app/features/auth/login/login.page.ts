import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonContent, IonIcon, IonSpinner,
} from '@ionic/angular/standalone';
import { BiometryType } from '@aparajita/capacitor-biometric-auth';

import { AuthService } from 'src/app/core/auth/auth.service';
import { BiometricService } from 'src/app/core/auth/biometric.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import { LoggerService } from 'src/app/core/logger/logger.service';
import { HapticsService } from 'src/app/core/ui/haptics.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, IonIcon, IonSpinner],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly bio = inject(BiometricService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly log = inject(LoggerService);
  private readonly haptics = inject(HapticsService);

  email = '';
  password = '';
  rememberDevice = true;
  showPw = signal(false);
  submitting = signal(false);
  errorMsg = signal<string | null>(null);

  /* ============================================================
     Biometric quick-login (Option C hybrid)
     ============================================================ */
  readonly biometricAvailable = signal<boolean>(false);
  readonly biometricWorking   = signal<boolean>(false);
  readonly biometricKind      = signal<BiometryType | null>(null);
  /** Makes the auto-trigger fire only once per mount. */
  private autoPrompted = false;

  async ngOnInit(): Promise<void> {
    // Whenever we land on /login we wipe any stale error banners.
    this.errorMsg.set(null);
    // If the router sent us here from an idle/expired session, surface it.
    const expired = this.route.snapshot.queryParamMap.get('expired');
    if (expired) {
      this.errorMsg.set('Signed out for inactivity. Unlock to continue.');
    }

    const avail = await this.auth.hasBiometricUnlockAvailable();
    if (avail) {
      this.biometricAvailable.set(true);
      this.biometricKind.set(await this.bio.biometryType());

      // Auto-trigger once on first mount so returning users get a
      // one-tap experience. If they cancel, they stay on the page and
      // can retry by tapping the card or use the password form below.
      if (!this.autoPrompted) {
        this.autoPrompted = true;
        // Small delay so the page paints before the system dialog opens
        // — feels much smoother than prompting during initial render.
        setTimeout(() => void this.tryBiometric(), 350);
      }
    }
  }

  biometryLabel(): string {
    const k = this.biometricKind();
    switch (k) {
      case BiometryType.faceId:
      case BiometryType.faceAuthentication:
        return 'Face ID';
      case BiometryType.touchId:
      case BiometryType.fingerprintAuthentication:
        return 'Fingerprint';
      case BiometryType.irisAuthentication:
        return 'Iris';
      default:
        return 'Biometric';
    }
  }

  biometryIcon(): string {
    const k = this.biometricKind();
    if (k === BiometryType.faceId || k === BiometryType.faceAuthentication) {
      return 'scan-outline';   // face silhouette reads well in Ionicons
    }
    return 'finger-print-outline';
  }

  async tryBiometric(): Promise<void> {
    if (this.biometricWorking()) return;
    this.biometricWorking.set(true);
    this.errorMsg.set(null);
    try {
      const result = await this.auth.biometricQuickLogin();
      switch (result) {
        case 'ok':
          await this.haptics.success();
          await this.router.navigate(['/tabs/home'], { replaceUrl: true });
          return;
        case 'cancelled':
          // Silent — user opted out of the prompt; card stays clickable.
          break;
        case 'expired':
          this.biometricAvailable.set(false);
          this.errorMsg.set('Session expired — please sign in again.');
          await this.haptics.warning();
          break;
        case 'unavailable':
          this.biometricAvailable.set(false);
          break;
        case 'error':
        default:
          await this.toasts.error('Could not unlock. Please try again.');
          break;
      }
    } finally {
      this.biometricWorking.set(false);
    }
  }

  /* ============================================================
     Password path (unchanged)
     ============================================================ */
  async submit(): Promise<void> {
    this.errorMsg.set(null);
    if (!this.email.trim() || !this.password) {
      this.errorMsg.set('Email and password are required.');
      return;
    }
    this.submitting.set(true);
    try {
      const res = await this.auth.login(this.email.trim(), this.password, this.rememberDevice);
      if (res.requiresOtpVerification) {
        await this.haptics.light();
        await this.router.navigate(['/otp']);
      } else {
        await this.haptics.success();
        await this.router.navigate(['/biometric-prompt'], { replaceUrl: true });
      }
    } catch (e: unknown) {
      this.log.warn('LoginPage', 'login failed', e);
      this.errorMsg.set(extractApiError(e) ?? 'Invalid email or password.');
      await this.haptics.error();
    } finally {
      this.submitting.set(false);
    }
  }

  togglePw(): void {
    this.showPw.update((v) => !v);
  }
}

function extractApiError(e: unknown): string | null {
  if (!e || typeof e !== 'object') return null;
  const err = e as { error?: unknown; message?: string };
  if (typeof err.error === 'string') return err.error;
  if (err.error && typeof err.error === 'object') {
    const inner = err.error as Record<string, unknown>;
    if (typeof inner['message'] === 'string') return inner['message'] as string;
  }
  return null;
}
