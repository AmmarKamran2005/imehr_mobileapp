import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';

import { BiometricService } from 'src/app/core/auth/biometric.service';
import { LoggerService } from 'src/app/core/logger/logger.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import { HapticsService } from 'src/app/core/ui/haptics.service';
import { BiometryType } from '@aparajita/capacitor-biometric-auth';

@Component({
  selector: 'app-biometric-prompt',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon],
  templateUrl: './biometric-prompt.page.html',
  styleUrls: ['./biometric-prompt.page.scss'],
})
export class BiometricPromptPage implements OnInit {
  private readonly bio = inject(BiometricService);
  private readonly router = inject(Router);
  private readonly log = inject(LoggerService);
  private readonly toasts = inject(ToastService);
  private readonly haptics = inject(HapticsService);

  available = signal<boolean>(false);
  biometryKind = signal<BiometryType | null>(null);
  submitting = signal(false);

  async ngOnInit(): Promise<void> {
    const avail = await this.bio.isAvailable();
    this.available.set(avail);
    if (avail) {
      this.biometryKind.set(await this.bio.biometryType());
    } else {
      // No biometric available — skip straight to schedule
      await this.skip();
    }
  }

  kindLabel(): string {
    const t = this.biometryKind();
    switch (t) {
      case BiometryType.faceId:         return 'Face ID';
      case BiometryType.touchId:        return 'Touch ID';
      case BiometryType.faceAuthentication: return 'Face Unlock';
      case BiometryType.fingerprintAuthentication: return 'Fingerprint';
      case BiometryType.irisAuthentication: return 'Iris';
      default:                          return 'biometric';
    }
  }

  async enable(): Promise<void> {
    this.submitting.set(true);
    try {
      const ok = await this.bio.authenticate('Enable biometric sign-in for IMEHR');
      if (ok) {
        await this.bio.setEnabledByUser(true);
        await this.haptics.success();
        await this.toasts.success('Biometric sign-in enabled');
      } else {
        await this.haptics.warning();
      }
    } finally {
      this.submitting.set(false);
      await this.router.navigate(['/schedule']);
    }
  }

  async skip(): Promise<void> {
    await this.bio.setEnabledByUser(false);
    await this.router.navigate(['/schedule']);
  }
}
