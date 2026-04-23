import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonIcon,
  IonRefresher, IonRefresherContent,
  IonModal, IonDatetime,
} from '@ionic/angular/standalone';

import { AuthService } from 'src/app/core/auth/auth.service';
import { NetworkService } from 'src/app/core/network/network.service';
import { HapticsService } from 'src/app/core/ui/haptics.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import { LoggerService } from 'src/app/core/logger/logger.service';
import { SignalRService } from 'src/app/core/realtime/signalr.service';

import { DashboardService } from 'src/app/core/services/dashboard.service';
import { AppointmentsService } from 'src/app/core/services/appointments.service';
import { ProvidersService, ProviderListItem } from 'src/app/core/services/providers.service';

import {
  AppointmentDto, AppointmentStatus,
} from 'src/app/core/models/appointment.model';
import { UserRole } from 'src/app/core/models/user.model';

import { AppointmentCardComponent } from 'src/app/shared/components/appointment-card.component';

type StatusFilterKey = 'scheduled' | 'checkedIn' | 'inProgress' | 'completed' | 'noShow' | 'cancelled';

interface StatusChoice {
  key: StatusFilterKey;
  label: string;
  match: (s: AppointmentStatus) => boolean;
}

const STATUS_CHOICES: readonly StatusChoice[] = [
  { key: 'scheduled',  label: 'Scheduled',   match: (s) => s === AppointmentStatus.Scheduled || s === AppointmentStatus.Confirmed },
  { key: 'checkedIn',  label: 'Checked In',  match: (s) => s === AppointmentStatus.CheckedIn },
  { key: 'inProgress', label: 'In Progress', match: (s) => s === AppointmentStatus.InProgress },
  { key: 'completed',  label: 'Completed',   match: (s) => s === AppointmentStatus.Completed },
  { key: 'noShow',     label: 'No Show',     match: (s) => s === AppointmentStatus.NoShow || s === AppointmentStatus.Missed },
  { key: 'cancelled',  label: 'Cancelled',   match: (s) => s === AppointmentStatus.Cancelled || s === AppointmentStatus.Rescheduled },
];

/**
 * Schedule tab — browse ANY day's appointments. Lightweight list layout
 * (not a full calendar grid) tuned for phones. Reuses the same
 * AppointmentCardComponent as the Home tab so row UX stays consistent.
 *
 *   - Previous / next day arrows
 *   - Date pill opens an ion-datetime modal to jump anywhere
 *   - "Today" pill shown when viewing a non-today date
 *   - Collapsible filter card: Provider dropdown + Status multi-chip
 *   - SignalR auto-refresh via ScheduleSignalRService subscription
 *   - Pull-to-refresh
 *   - Creating / editing appointments is out of scope (read-only)
 */
@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonIcon,
    IonRefresher, IonRefresherContent,
    IonModal, IonDatetime,
    AppointmentCardComponent,
  ],
  templateUrl: './schedule.page.html',
  styleUrls: ['./schedule.page.scss'],
})
export class SchedulePage implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly network = inject(NetworkService);
  private readonly haptics = inject(HapticsService);
  private readonly toasts = inject(ToastService);
  private readonly log = inject(LoggerService);
  private readonly signalr = inject(SignalRService);

  private readonly dashboard = inject(DashboardService);
  private readonly apptsApi = inject(AppointmentsService);
  private readonly providersApi = inject(ProvidersService);

  readonly user = this.auth.user;
  readonly online = this.network.online;
  readonly realtimeConnected = this.signalr.connectionState;

  /* ============================================================
     State
     ============================================================ */
  readonly selectedDate = signal<Date>(todayStart());
  readonly appointments = signal<AppointmentDto[]>([]);
  readonly loading = signal<boolean>(false);

  // Filters
  readonly providers = signal<ProviderListItem[]>([]);
  readonly providerId = signal<number | null>(null);
  readonly statusSelection = signal<Set<StatusFilterKey>>(new Set());
  readonly filtersOpen = signal<boolean>(false);

  // Date picker modal
  readonly datePickerOpen = signal<boolean>(false);

  readonly statusChoices = STATUS_CHOICES;

  /* ============================================================
     Derived
     ============================================================ */
  readonly isToday = computed(() =>
    this.selectedDate().toDateString() === new Date().toDateString(),
  );

  readonly dateHeading = computed(() => {
    const d = this.selectedDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString())     return 'Today';
    if (d.toDateString() === tomorrow.toDateString())  return 'Tomorrow';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    });
  });

  readonly dateSubheading = computed(() => {
    return this.selectedDate().toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  });

  readonly activeFilterCount = computed(() => {
    let n = 0;
    if (this.providerId() != null) n += 1;
    if (this.statusSelection().size > 0) n += 1;
    return n;
  });

  readonly filteredAppointments = computed(() => {
    const sel = this.statusSelection();
    if (sel.size === 0) return this.appointments();
    return this.appointments().filter((a) =>
      Array.from(sel).some((key) =>
        STATUS_CHOICES.find((c) => c.key === key)?.match(a.status) ?? false,
      ),
    );
  });

  /** ISO YYYY-MM-DD for <ion-datetime value>. */
  readonly datePickerValue = computed(() => {
    const d = this.selectedDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  /** Hide provider filter for therapist-only accounts. */
  readonly showProviderFilter = computed(() => {
    const r = this.user()?.role;
    return r !== UserRole.Therapist;
  });

  private sub: Subscription | null = null;
  private realtimeDebounce: number | null = null;

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadProviders(), this.loadAppointments()]);

    void this.signalr.ensureStarted();
    this.sub = this.signalr.schedule$.subscribe(() => {
      if (this.realtimeDebounce != null) clearTimeout(this.realtimeDebounce);
      this.realtimeDebounce = window.setTimeout(() => {
        this.log.debug('Schedule', 'realtime refresh');
        void this.loadAppointments();
      }, 250);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.realtimeDebounce != null) clearTimeout(this.realtimeDebounce);
  }

  /* ============================================================
     Loaders
     ============================================================ */
  private async loadProviders(): Promise<void> {
    if (!this.showProviderFilter()) return;
    const providers = await this.providersApi.list({ activeOnly: true });
    this.providers.set(providers);
  }

  private loadAppointments(): Promise<void> {
    return new Promise((resolve) => {
      this.loading.set(true);
      const pid = this.providerId() ?? undefined;
      this.dashboard.appointmentsForDay(this.selectedDate(), { providerId: pid })
        .subscribe((rows) => {
          // Sort ascending by start time for a predictable list.
          const sorted = [...rows].sort((a, b) =>
            Date.parse(a.startTime) - Date.parse(b.startTime),
          );
          this.appointments.set(sorted);
          this.loading.set(false);
          resolve();
        });
    });
  }

  async onRefresh(event: Event): Promise<void> {
    try { await this.loadAppointments(); }
    finally {
      const target = event.target as HTMLIonRefresherElement | null;
      await target?.complete();
    }
  }

  /* ============================================================
     Date navigation
     ============================================================ */
  prevDay(): void { this.shiftDay(-1); }
  nextDay(): void { this.shiftDay(1); }

  private shiftDay(days: number): void {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() + days);
    this.selectedDate.set(d);
    void this.haptics.light();
    void this.loadAppointments();
  }

  async goToToday(): Promise<void> {
    if (this.isToday()) return;
    await this.haptics.light();
    this.selectedDate.set(todayStart());
    void this.loadAppointments();
  }

  openDatePicker(): void { this.datePickerOpen.set(true); }
  closeDatePicker(): void { this.datePickerOpen.set(false); }

  onDatePicked(event: CustomEvent): void {
    const value = (event.detail as { value?: string | string[] }).value;
    const iso = Array.isArray(value) ? value[0] : value;
    if (!iso) return;
    // ion-datetime emits "YYYY-MM-DDTHH:mm:ss..." — take only the day part.
    const datePart = iso.slice(0, 10);
    const [y, m, d] = datePart.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return;
    const picked = new Date(y, m - 1, d);
    this.selectedDate.set(picked);
    this.datePickerOpen.set(false);
    void this.loadAppointments();
  }

  /* ============================================================
     Filters
     ============================================================ */
  toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }

  onProviderChange(v: string | number | null): void {
    const id = v == null || v === '' ? null : Number(v);
    this.providerId.set(Number.isFinite(id as number) ? (id as number) : null);
    void this.loadAppointments();
  }

  toggleStatus(key: StatusFilterKey): void {
    const s = new Set(this.statusSelection());
    if (s.has(key)) s.delete(key);
    else s.add(key);
    this.statusSelection.set(s);
    // status filter is purely client-side — no re-fetch needed
  }

  resetFilters(): void {
    this.providerId.set(null);
    this.statusSelection.set(new Set());
    this.filtersOpen.set(false);
    void this.loadAppointments();
  }

  isStatusSelected(key: StatusFilterKey): boolean {
    return this.statusSelection().has(key);
  }

  /* ============================================================
     Row actions (reuses Home-tab handlers verbatim)
     ============================================================ */
  openAppointment(a: AppointmentDto): void {
    void this.router.navigate(['/appointment', a.appointmentId]);
  }

  async onRowAction(evt: { kind: 'check-in' | 'start' | 'resume' | 'view'; appointment: AppointmentDto }): Promise<void> {
    const a = evt.appointment;
    try {
      switch (evt.kind) {
        case 'check-in':
          await this.apptsApi.checkIn(a.appointmentId);
          await this.haptics.light();
          await this.toasts.success(`${a.patientName ?? 'Patient'} checked in`);
          await this.loadAppointments();
          break;
        case 'start':
          await this.apptsApi.startVisit(a.appointmentId);
          await this.haptics.medium();
          await this.router.navigate(['/encounter', a.appointmentId]);
          break;
        case 'resume':
          await this.haptics.light();
          await this.router.navigate(['/encounter', a.appointmentId]);
          break;
        case 'view':
          await this.router.navigate(['/appointment', a.appointmentId]);
          break;
      }
    } catch (e) {
      this.log.warn('Schedule', 'row action failed', e);
      await this.toasts.error('Action failed. Try again.');
    }
  }
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
