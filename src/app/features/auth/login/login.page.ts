import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent, IonIcon, IonSpinner,
} from '@ionic/angular/standalone';

import { AuthService } from 'src/app/core/auth/auth.service';
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
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly log = inject(LoggerService);
  private readonly haptics = inject(HapticsService);

  email = '';
  password = '';
  rememberDevice = true;
  showPw = signal(false);
  submitting = signal(false);
  errorMsg = signal<string | null>(null);

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
