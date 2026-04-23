import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
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
import { SignalRService } from 'src/app/core/realtime/signalr.service';

import { DashboardService } from 'src/app/core/services/dashboard.service';
import { AppointmentsService } from 'src/app/core/services/appointments.service';

import { AppointmentDto, AppointmentStatus } from 'src/app/core/models/appointment.model';
import { DashboardStats, StatCard } from 'src/app/core/models/dashboard.model';
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
    RoleBadgeComponent, StatCardComponent,
    ActiveVisitBannerComponent, DateStripComponent, AppointmentCardComponent,
  ],
  templateUrl: './schedule.page.html',
  styleUrls: ['./schedule.page.scss'],
})
export class SchedulePage implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly network = inject(NetworkService);
  private readonly haptics = inject(HapticsService);
  private readonly toasts = inject(ToastService);
  private readonly log = inject(LoggerService);
  private readonly router = inject(Router);
  private readonly signalr = inject(SignalRService);

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
  readonly realtimeConnected = this.signalr.connectionState;

  // Derived
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  readonly activeVisit = computed<AppointmentDto | null>(() =>
    this.appointments().find((a) => a.status === AppointmentStatus.InProgress) ?? null,
  );

  readonly isSelectedToday = computed(() =>
    this.selectedDate().toDateString() === new Date().toDateString(),
  );

  readonly isNurseUser = computed(() => {
    const r = this.user()?.role;
    return r != null && isNurseRole(r);
  });

  // Subtitle under the date header so users see WHICH day they're looking at.
  readonly dateHeading = computed(() => {
    const d = this.selectedDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString())     return 'Today';
    if (d.toDateString() === tomorrow.toDateString())  return 'Tomorrow';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  });

  private sub: Subscription | null = null;
  private realtimeDebounce: number | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadAll();

    // Fire-and-forget — pages subscribe; service handles reconnects.
    void this.signalr.ensureStarted();
    this.sub = this.signalr.schedule$.subscribe((ev) => {
      // Debounce bursts: a single appointment edit can emit multiple events.
      if (this.realtimeDebounce != null) clearTimeout(this.realtimeDebounce);
      this.realtimeDebounce = window.setTimeout(() => {
        this.log.debug('Schedule', 'realtime refresh from', ev.kind);
        void this.loadAppointments();
        if (ev.kind === 'appointment-changed') void this.loadStats();
      }, 250);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.realtimeDebounce != null) clearTimeout(this.realtimeDebounce);
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

  /**
   * Picks the right endpoint based on the selected date:
   *   • today  → /api/dashboard/appointments (server-authoritative "today")
   *   • other  → /api/appointments?startDate=&endDate=&providerId=
   */
  private loadAppointments(): Promise<void> {
    return new Promise((resolve) => {
      const user = this.user();
      const providerId = user?.providerId ?? undefined;
      const obs = this.isSelectedToday()
        ? this.dashboard.todayAppointments(providerId)
        : this.dashboard.appointmentsForDay(this.selectedDate(), { providerId });

      obs.subscribe((rows) => {
        // Client-side sort by startTime to guard against unordered responses.
        const sorted = [...rows].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
        this.appointments.set(sorted);
        resolve();
      });
    });
  }

  private loadStats(): Promise<void> {
    return new Promise((resolve) => {
      this.dashboard.stats().subscribe((s) => {
        const role = this.user()?.role ?? UserRole.Clinician;
        this.statCards.set(buildStatCards(s, role));
        resolve();
      });
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
    void this.toasts.show(`${card.label}: ${card.value}`);
  }

  async jumpToToday(): Promise<void> {
    if (this.isSelectedToday()) return;
    await this.haptics.light();
    this.selectedDate.set(todayStart());
    void this.loadAppointments();
  }
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 3 stat cards for Home — Today / Completed / Pending notes.
 * Dropped "No show" per product direction (can come back as a drill-down
 * on the dedicated Schedule page when that lands).
 */
function buildStatCards(s: DashboardStats, _role: UserRole): StatCard[] {
  return [
    { key: 'today',        icon: 'calendar-outline',         tone: 'primary', label: 'Today',         value: s.todayAppointments ?? 0 },
    { key: 'completed',    icon: 'checkmark-circle-outline', tone: 'success', label: 'Completed',     value: s.completedToday ?? 0 },
    { key: 'pendingNotes', icon: 'document-text-outline',    tone: 'info',    label: 'Pending notes', value: s.pendingNotes ?? 0 },
  ];
}
