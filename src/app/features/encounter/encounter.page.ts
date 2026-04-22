import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonSpinner, IonIcon,
  ActionSheetController,
} from '@ionic/angular/standalone';

import { EncounterStore } from 'src/app/core/services/encounter.store';
import { AuthService } from 'src/app/core/auth/auth.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import { HapticsService } from 'src/app/core/ui/haptics.service';
import { LoggerService } from 'src/app/core/logger/logger.service';

import { ENCOUNTER_STEPS } from 'src/app/core/models/encounter.model';
import { formatTime12, initialsFromName } from 'src/app/core/models/appointment.model';
import { UserRole } from 'src/app/core/models/user.model';

import { EncounterStepperComponent } from './components/encounter-stepper.component';
import { SaveStripComponent } from './components/save-strip.component';
import { StepVitalsComponent } from './steps/step-vitals.component';
import { StepPlaceholderComponent } from './steps/step-placeholder.component';

/**
 * The encounter wizard — shell plus step switcher.
 *
 * Phase 3 ships Step 0 (Vitals) fully wired to /api/patients/{pid}/vitals.
 * Steps 1–7 render a placeholder that names the phase that will deliver them.
 * All state lives in EncounterStore (signals) so step components stay thin.
 */
@Component({
  selector: 'app-encounter',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonSpinner, IonIcon,
    EncounterStepperComponent, SaveStripComponent,
    StepVitalsComponent, StepPlaceholderComponent,
  ],
  templateUrl: './encounter.page.html',
  styleUrls: ['./encounter.page.scss'],
})
export class EncounterPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly actionSheets = inject(ActionSheetController);

  readonly store = inject(EncounterStore);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly haptics = inject(HapticsService);
  private readonly log = inject(LoggerService);

  readonly steps = ENCOUNTER_STEPS;
  readonly currentStep = this.store.step;
  readonly completed   = this.store.completed;
  readonly saveStatus  = this.store.saveStatus;
  readonly loading     = this.store.loading;
  readonly appointment = this.store.appointment;

  readonly role = computed(() => this.auth.user()?.role ?? UserRole.Clinician);

  readonly patientInitials = computed(() => initialsFromName(this.appointment()?.patientName));

  readonly ctx = computed(() => {
    const a = this.appointment();
    if (!a) return '';
    const t = formatTime12(a.startTime);
    const parts = [`MRN ${a.patientMrn ?? '—'}`, `${t.hour} ${t.mer}`, a.typeName ?? 'Visit'];
    return parts.join(' · ');
  });

  readonly isFirstStep = computed(() => this.currentStep() === 0);
  readonly isLastStep  = computed(() => this.currentStep() === this.steps.length - 1);

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('appointmentId'));
    if (!Number.isFinite(id) || id <= 0) {
      await this.router.navigate(['/schedule']);
      return;
    }
    await this.store.enter(id);
    if (!this.appointment()) {
      await this.toasts.error('Could not load this appointment.');
      await this.router.navigate(['/schedule']);
    }
  }

  /* ============================================================
     Navigation
     ============================================================ */
  onPickStep(n: number): void {
    this.store.goStep(n);
  }

  next(): void {
    void this.haptics.light();
    this.store.next();
  }

  prev(): void {
    void this.haptics.light();
    this.store.prev();
  }

  back(): void {
    void this.router.navigate(['/schedule']);
  }

  async openMenu(): Promise<void> {
    const sheet = await this.actionSheets.create({
      header: 'Encounter',
      buttons: [
        { text: 'Save & exit',    icon: 'save-outline',              handler: () => { void this.back(); } },
        { text: 'Patient chart',  icon: 'person-outline',            handler: () => { void this.toasts.show('Patient chart arrives in Phase 6'); } },
        { text: 'Telehealth link', icon: 'videocam-outline',         handler: () => { void this.copyTelehealth(); } },
        { text: 'Discard & exit', icon: 'close-circle-outline',      role: 'destructive', handler: () => { void this.back(); } },
        { text: 'Cancel',         role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async copyTelehealth(): Promise<void> {
    const url = this.appointment()?.telehealthUrl;
    if (!url) { await this.toasts.show('No telehealth link on this appointment'); return; }
    try { await navigator.clipboard?.writeText(url); } catch { /* ignore */ }
    await this.toasts.success('Telehealth link copied');
  }
}
