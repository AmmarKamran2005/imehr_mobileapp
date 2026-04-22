import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';

import { AuthService } from 'src/app/core/auth/auth.service';
import { LoggerService } from 'src/app/core/logger/logger.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import { HapticsService } from 'src/app/core/ui/haptics.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-otp',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSpinner],
  templateUrl: './otp.page.html',
  styleUrls: ['./otp.page.scss'],
})
export class OtpPage implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly log = inject(LoggerService);
  private readonly toasts = inject(ToastService);
  private readonly haptics = inject(HapticsService);

  code = '';
  submitting = signal(false);
  errorMsg = signal<string | null>(null);
  resendInSec = signal(Math.floor(environment.otp.resendCooldownMs / 1000));
  private tickHandle: number | null = null;

  constructor() {
    this.startCooldown();
  }

  ngOnDestroy(): void {
    if (this.tickHandle != null) clearInterval(this.tickHandle);
  }

  onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const digits = input.value.replace(/[^0-9]/g, '').slice(0, environment.otp.codeLength);
    input.value = digits;
    this.code = digits;
    this.errorMsg.set(null);
  }

  async submit(): Promise<void> {
    if (this.code.length !== environment.otp.codeLength) {
      this.errorMsg.set('Enter the 6-digit code.');
      return;
    }
    this.submitting.set(true);
    try {
      await this.auth.verifyOtp(this.code);
      await this.haptics.success();
      await this.router.navigate(['/biometric-prompt']);
    } catch (e: unknown) {
      this.log.warn('OtpPage', 'verify failed', e);
      this.errorMsg.set('Incorrect or expired code.');
      await this.haptics.error();
    } finally {
      this.submitting.set(false);
    }
  }

  async resend(): Promise<void> {
    if (this.resendInSec() > 0) return;
    try {
      await this.auth.resendOtp();
      await this.toasts.success('Code resent');
      this.startCooldown();
    } catch (e) {
      this.log.warn('OtpPage', 'resend failed', e);
      await this.toasts.error('Could not resend code.');
    }
  }

  backToLogin(): void {
    void this.router.navigate(['/login']);
  }

  private startCooldown(): void {
    this.resendInSec.set(Math.floor(environment.otp.resendCooldownMs / 1000));
    if (this.tickHandle != null) clearInterval(this.tickHandle);
    this.tickHandle = window.setInterval(() => {
      const left = this.resendInSec() - 1;
      if (left <= 0) {
        this.resendInSec.set(0);
        if (this.tickHandle != null) clearInterval(this.tickHandle);
      } else {
        this.resendInSec.set(left);
      }
    }, 1000);
  }
}
