import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon,
  AlertController,
} from '@ionic/angular/standalone';

import { AuthService } from 'src/app/core/auth/auth.service';
import { ThemeService, ThemePref } from 'src/app/core/ui/theme.service';
import { BiometricService } from 'src/app/core/auth/biometric.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import { roleLabel } from 'src/app/core/models/user.model';
import { SecureStorageService } from 'src/app/core/storage/secure-storage.service';
import { signal } from '@angular/core';

/**
 * More / Settings tab.
 *
 *   • Profile card (name, role, email, initials)
 *   • Change password (stub — opens Ionic alert)
 *   • Biometric sign-in toggle
 *   • Theme picker (Light / Dark / Auto)
 *   • About
 *   • Log out
 */
@Component({
  selector: 'app-more',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon,
  ],
  templateUrl: './more.page.html',
  styleUrls: ['./more.page.scss'],
})
export class MorePage {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly bio = inject(BiometricService);
  private readonly toasts = inject(ToastService);
  private readonly alerts = inject(AlertController);
  private readonly storage = inject(SecureStorageService);

  readonly user = this.auth.user;
  readonly themePref = this.theme.pref;
  readonly biometricOn = signal<boolean>(false);
  readonly biometricAvailable = signal<boolean>(false);

  readonly initials = computed(() => {
    const u = this.user();
    if (!u?.fullName) return '?';
    const parts = u.fullName.trim().split(/\s+/).slice(0, 2);
    return parts.map((s) => s[0]?.toUpperCase() ?? '').join('') || '?';
  });

  readonly role = computed(() => {
    const u = this.user();
    return u ? roleLabel(u.role) : '';
  });

  async ionViewWillEnter(): Promise<void> {
    this.biometricAvailable.set(await this.bio.isAvailable());
    this.biometricOn.set(await this.bio.isEnabledByUser());
  }

  setTheme(t: ThemePref): void { void this.theme.set(t); }

  async toggleBiometric(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const on = input.checked;
    if (on) {
      const ok = await this.bio.authenticate('Enable biometric sign-in');
      if (!ok) {
        input.checked = false;
        await this.toasts.warn('Biometric was not enabled.');
        return;
      }
      await this.bio.setEnabledByUser(true);
      this.biometricOn.set(true);
      await this.toasts.success('Biometric enabled');
    } else {
      await this.bio.setEnabledByUser(false);
      this.biometricOn.set(false);
    }
  }

  async changePassword(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Change password',
      message: 'Change-password inline flow lands in a later polish pass. You can reset your password from the web portal for now.',
      buttons: ['OK'],
    });
    await a.present();
  }

  async logout(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Log out?',
      message: 'You will need to sign in again on this device.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Log out',
          role: 'destructive',
          handler: () => {
            void this.auth.logout();
            return true;
          },
        },
      ],
    });
    await a.present();
  }
}
