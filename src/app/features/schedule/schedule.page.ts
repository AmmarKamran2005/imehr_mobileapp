import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon,
} from '@ionic/angular/standalone';

import { AuthService } from 'src/app/core/auth/auth.service';
import { ThemeService } from 'src/app/core/ui/theme.service';
import { NetworkService } from 'src/app/core/network/network.service';
import { roleLabel } from 'src/app/core/models/user.model';

/**
 * Placeholder Schedule / Dashboard page — real implementation lands in Phase 1.
 * For now this confirms routing + auth state wire together.
 */
@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButtons, IonButton, IonIcon,
  ],
  templateUrl: './schedule.page.html',
  styleUrls: ['./schedule.page.scss'],
})
export class SchedulePage {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly network = inject(NetworkService);

  readonly user = this.auth.user;
  readonly online = this.network.online;
  readonly currentTheme = this.theme.pref;

  readonly greeting = computed(() => {
    const u = this.user();
    if (!u) return 'IMEHR';
    return u.fullName;
  });

  readonly roleChip = computed(() => {
    const u = this.user();
    return u ? roleLabel(u.role) : '';
  });

  async logout(): Promise<void> {
    await this.auth.logout();
  }

  async toggleTheme(): Promise<void> {
    const order: Array<'light' | 'dark' | 'auto'> = ['light', 'dark', 'auto'];
    const next = order[(order.indexOf(this.currentTheme()) + 1) % order.length];
    await this.theme.set(next);
  }
}
