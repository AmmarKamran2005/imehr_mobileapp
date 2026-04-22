import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';

import { AuthService } from 'src/app/core/auth/auth.service';
import { ThemeService } from 'src/app/core/ui/theme.service';
import { NetworkService } from 'src/app/core/network/network.service';
import { HapticsService } from 'src/app/core/ui/haptics.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import { LoggerService } from 'src/app/core/logger/logger.service';

import { DashboardService } from 'src/app/core/services/dashboard.service';
import { AppointmentsService } from 'src/app/core/services/appointments.service';

import {
  AppointmentDto, AppointmentStatus,
} from 'src/app/core/models/appointment.model';
import { StatCard } from 'src/app/core/models/dashboard.model';
import { UserRole, isNurseRole } from 'src/app/core/models/user.model';

import { RoleBadgeComponent } from 'src/app/shared/components/role-badge.component';
import { StatCardComponent } from 'src/app/shared/components/stat-card.component';
import { ActiveVisitBannerComponent } from 'src/app/shared/components/active-visit-banner.component';
import { DateStripComponent } from 'src/app/shared/components/date-strip.component';
import { AppointmentCardComponent } from 'src/app/shared/components/appointment-card.component';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonRefresher, IonRefresherContent,
    RoleBadgeComponent,
    StatCardComponent,
    ActiveVisitBannerComponent,
    DateStripComponent,
    AppointmentCardComponent,
  ],
  templateUrl: './schedule.page.html',
  styleUrls: ['./schedule.page.scss'],
})
export class SchedulePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly network = inject(NetworkService);
  private readonly haptics = inject(HapticsService);
  private readonly toasts = inject(ToastService);
  private readonly log = inject(LoggerService);
  private readonly router = inject(Router);

  private readonly dashboard = inject(DashboardService);
  private readonly apptsApi = inject(AppointmentsService);

  readonly user = this.auth.user;
  readonly online = this.network.online;

  // Data
  readonly selectedDate = signal(todayStart());
  readonly appointments = signal<AppointmentDto[]>([]);
  readonly loading = signal<boolean>(false);
  readonly refreshing = signal<boolean>(false);
  readonly statCards = signal<StatCard[]>([]);

  // Derived
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  readonly activeVisit = computed<AppointmentDto | null>(() => {
    return this.appointments().find((a) => a.status === AppointmentStatus.InProgress) ?? null;
  });

  readonly isSelectedToday = computed(() =>
    this.selectedDate().toDateString() === new Date().toDateString(),
  );

  readonly isNurseUser = computed(() => {
    const r = this.user()?.role;
    return r != null && isNurseRole(r);
  });

  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  /* ============================================================
     Data loading
     ============================================================ */
  private async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      await Promise.all([this.loadAppointments(), this.loadStats()]);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadAppointments(): Promise<void> {
    this.dashboard.listAppointments(this.selectedDate()).subscribe((rows) => {
      this.appointments.set(rows);
    });
  }

  private async loadStats(): Promise<void> {
    this.dashboard.stats().subscribe((s) => {
      const role = this.user()?.role ?? UserRole.Clinician;
      this.statCards.set(buildStatCards(s, role));
    });
  }

  async onRefresh(event: Event): Promise<void> {
    this.refreshing.set(true);
    try { await this.loadAll(); }
    finally {
      this.refreshing.set(false);
      const target = event.target as HTMLIonRefresherElement | null;
      await target?.complete();
    }
  }

  /* ============================================================
     Date / selection
     ============================================================ */
  onDatePick(d: Date): void {
    this.selectedDate.set(d);
    void this.loadAppointments();
  }

  /* ============================================================
     Appointment actions
     ============================================================ */
  openAppointment(a: AppointmentDto): void {
    void this.router.navigate(['/appointment', a.appointmentId]);
  }

  async onRowAction(evt: { kind: 'check-in' | 'start' | 'resume' | 'view'; appointment: AppointmentDto }): Promise<void> {
    const a = evt.appointment;
    try {
      switch (evt.kind) {
        case 'check-in': {
          await this.apptsApi.checkIn(a.appointmentId);
          await this.haptics.light();
          await this.toasts.success(`${a.patientName ?? 'Patient'} checked in`);
          await this.loadAppointments();
          break;
        }
        case 'start': {
          await this.apptsApi.startVisit(a.appointmentId);
          await this.haptics.medium();
          await this.router.navigate(['/encounter', a.appointmentId]);
          break;
        }
        case 'resume': {
          await this.haptics.light();
          await this.router.navigate(['/encounter', a.appointmentId]);
          break;
        }
        case 'view': {
          await this.router.navigate(['/appointment', a.appointmentId]);
          break;
        }
      }
    } catch (e) {
      this.log.warn('Schedule', 'row action failed', e);
      await this.toasts.error('Action failed. Try again.');
    }
  }

  onResume(a: AppointmentDto): void {
    void this.router.navigate(['/encounter', a.appointmentId]);
  }

  /* ============================================================
     Misc
     ============================================================ */
  async logout(): Promise<void> {
    await this.auth.logout();
  }

  async toggleTheme(): Promise<void> {
    const order: Array<'light' | 'dark' | 'auto'> = ['light', 'dark', 'auto'];
    const next = order[(order.indexOf(this.theme.pref()) + 1) % order.length];
    await this.theme.set(next);
  }

  onStatTap(card: StatCard): void {
    // Phase 2 — no drill-downs yet; hint the user
    void this.toasts.show(`${card.label}: ${card.value}`);
  }
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildStatCards(s: { today: number; pendingOrders: number; noShow: number; missed: number; [k: string]: number | undefined }, role: UserRole): StatCard[] {
  const cards: StatCard[] = [
    { key: 'today',         icon: 'calendar-outline',       tone: 'primary', label: 'Today',          value: s.today ?? 0 },
    { key: 'pendingOrders', icon: 'clipboard-outline',      tone: 'info',    label: 'Pending Orders', value: s.pendingOrders ?? 0 },
  ];
  // Nurse / MA don't see No Show / Missed on the web dashboard — replicate.
  if (!isNurseRole(role)) {
    cards.push(
      { key: 'noShow', icon: 'person-add-outline',  tone: 'warning', label: 'No Show', value: s.noShow ?? 0 },
      { key: 'missed', icon: 'alert-circle-outline', tone: 'danger', label: 'Missed',  value: s.missed ?? 0 },
    );
  } else {
    // Give nurse a third useful counter — triage count (fallback to 0 if server doesn't send it).
    cards.push({
      key: 'triage',
      icon: 'time-outline',
      tone: 'warning',
      label: 'Triage',
      value: (s['triage'] ?? 0) as number,
    });
  }
  return cards;
}
