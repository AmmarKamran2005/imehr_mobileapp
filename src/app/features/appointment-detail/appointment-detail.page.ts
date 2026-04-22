import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonButton, IonIcon, IonSpinner,
} from '@ionic/angular/standalone';

import { AppointmentsService } from 'src/app/core/services/appointments.service';
import { AppointmentDetailDto, AppointmentStatus, initialsFromName, statusMeta } from 'src/app/core/models/appointment.model';
import { LoggerService } from 'src/app/core/logger/logger.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import { HapticsService } from 'src/app/core/ui/haptics.service';
import { formatTime12 } from 'src/app/core/models/appointment.model';

@Component({
  selector: 'app-appointment-detail',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonButton, IonIcon, IonSpinner,
  ],
  templateUrl: './appointment-detail.page.html',
  styleUrls: ['./appointment-detail.page.scss'],
})
export class AppointmentDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AppointmentsService);
  private readonly log = inject(LoggerService);
  private readonly toasts = inject(ToastService);
  private readonly haptics = inject(HapticsService);

  readonly appointmentId = signal<number | null>(null);
  readonly detail = signal<AppointmentDetailDto | null>(null);
  readonly loading = signal<boolean>(false);
  readonly acting = signal<boolean>(false);

  readonly meta = computed(() => {
    const d = this.detail();
    return d ? statusMeta(d.status) : null;
  });

  readonly initials = computed(() => initialsFromName(this.detail()?.patientName));

  readonly timeRange = computed(() => {
    const d = this.detail();
    if (!d) return '';
    const start = formatTime12(d.startTime);
    const end = d.endTime ? formatTime12(d.endTime) : null;
    const base = `${start.hour} ${start.mer}`;
    return end ? `${base} – ${end.hour} ${end.mer}` : base;
  });

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      await this.router.navigate(['/schedule']);
      return;
    }
    this.appointmentId.set(id);
    await this.load();
  }

  private async load(): Promise<void> {
    const id = this.appointmentId();
    if (!id) return;
    this.loading.set(true);
    try {
      const d = await this.api.get(id);
      this.detail.set(d);
    } catch (e) {
      this.log.warn('AppointmentDetail', 'load failed', e);
    } finally {
      this.loading.set(false);
    }
  }

  async checkIn(): Promise<void> {
    const id = this.appointmentId();
    if (!id || this.acting()) return;
    this.acting.set(true);
    try {
      await this.api.checkIn(id);
      await this.haptics.light();
      await this.toasts.success('Patient checked in');
      await this.load();
    } catch (e) {
      this.log.warn('AppointmentDetail', 'checkIn failed', e);
      await this.toasts.error('Check-in failed.');
    } finally {
      this.acting.set(false);
    }
  }

  async startVisit(): Promise<void> {
    const id = this.appointmentId();
    if (!id || this.acting()) return;
    this.acting.set(true);
    try {
      await this.api.startVisit(id);
      await this.haptics.medium();
      await this.toasts.success('Visit started');
      await this.load();
      // Phase 3 will navigate to /encounter/:id. For now land on the refreshed detail.
    } catch (e) {
      this.log.warn('AppointmentDetail', 'startVisit failed', e);
      await this.toasts.error('Could not start the visit.');
    } finally {
      this.acting.set(false);
    }
  }

  async resumeVisit(): Promise<void> {
    // Placeholder until Phase 3 (encounter wizard). Safe toast.
    await this.toasts.show('Encounter wizard arrives in Phase 3.');
  }

  async openTelehealth(): Promise<void> {
    const d = this.detail();
    if (!d?.telehealthUrl) return;
    // In Phase 2 we only copy the link; in-app video lands later if at all.
    try { await navigator.clipboard?.writeText(d.telehealthUrl); } catch { /* ignore */ }
    await this.toasts.success('Telehealth link copied');
  }

  statusCls(): string {
    const m = this.meta();
    if (!m) return '';
    // chipClass is like 'chip-warning' — strip the prefix for our classlist use
    return m.chipClass.replace('chip-', '');
  }

  isScheduledOrConfirmed(): boolean {
    const s = this.detail()?.status;
    return s === AppointmentStatus.Scheduled || s === AppointmentStatus.Confirmed;
  }

  isCheckedIn():  boolean { return this.detail()?.status === AppointmentStatus.CheckedIn; }
  isInProgress(): boolean { return this.detail()?.status === AppointmentStatus.InProgress; }
  isCompleted():  boolean { return this.detail()?.status === AppointmentStatus.Completed; }

  back(): void { void this.router.navigate(['/schedule']); }
}
