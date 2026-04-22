import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { AppointmentDetailDto } from '../models/appointment.model';
import {
  ENCOUNTER_STEPS, EncounterDto, VitalDto,
  blankVitals, computeBmi,
  defaultStepForRole,
} from '../models/encounter.model';
import { UserRole } from '../models/user.model';

import { AppointmentsService } from './appointments.service';
import { EncounterService } from './encounter.service';
import { VitalsService } from './vitals.service';
import { AuthService } from '../auth/auth.service';
import { LoggerService } from '../logger/logger.service';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SaveKind = 'vitals' | 'encounter';

/**
 * Central reactive store for an ACTIVE encounter session.
 *
 * Lifecycle:
 *   1. EncounterPage calls `enter(appointmentId)` on init.
 *   2. Store loads the appointment → ensures an encounter exists → loads
 *      latest vitals for this encounter.
 *   3. Each step component reads/writes through this store.
 *   4. Debounced saves (1200ms) fire POST/PUT and update the save status strip.
 *   5. On exit / logout, `reset()` clears state.
 */
@Injectable({ providedIn: 'root' })
export class EncounterStore {
  private readonly appointmentsApi = inject(AppointmentsService);
  private readonly encountersApi = inject(EncounterService);
  private readonly vitalsApi = inject(VitalsService);
  private readonly auth = inject(AuthService);
  private readonly log = inject(LoggerService);

  /* ============================================================
     Signals
     ============================================================ */
  readonly appointment = signal<AppointmentDetailDto | null>(null);
  readonly encounter   = signal<EncounterDto | null>(null);
  readonly vitals      = signal<VitalDto | null>(null);
  readonly historicalVitals = signal<VitalDto[]>([]);

  readonly step = signal<number>(0);
  readonly completed = signal<boolean[]>(new Array(ENCOUNTER_STEPS.length).fill(false));

  readonly loading = signal<boolean>(false);
  readonly saveStatus = signal<SaveStatus>('idle');
  readonly lastSavedAt = signal<Date | null>(null);

  readonly currentStepDef = computed(() => ENCOUNTER_STEPS[this.step()] ?? ENCOUNTER_STEPS[0]);

  /* ============================================================
     Save pipeline — one subject per domain object, each debounced
     independently so keystrokes on vitals don't delay CC/HPI saves
     when those arrive in Phase 4.
     ============================================================ */
  private readonly saveSubject = new Subject<SaveKind>();
  private savedTimer: number | null = null;

  constructor() {
    this.saveSubject.pipe(debounceTime(1200)).subscribe((kind) => {
      void this.flush(kind);
    });

    // Auto-reset once the user logs out
    effect(() => {
      if (!this.auth.isAuthenticated()) this.reset();
    });
  }

  /* ============================================================
     Public: lifecycle
     ============================================================ */
  async enter(appointmentId: number): Promise<void> {
    this.loading.set(true);
    try {
      const appt = await this.appointmentsApi.get(appointmentId);
      this.appointment.set(appt);
      if (!appt) {
        this.loading.set(false);
        return;
      }

      // Ensure we have an encounter row to attach data to.
      const enc = await this.ensureEncounter(appt);
      this.encounter.set(enc);

      // Load existing vitals (latest for this encounter, else blank).
      const all = await this.vitalsApi.list(appt.patientId);
      this.historicalVitals.set(all);
      const mine = enc
        ? all.find((v) => v.encounterId === enc.encounterId) ?? null
        : null;
      this.vitals.set(mine ?? blankVitals(appt.patientId, enc?.encounterId ?? null));

      // Compute initial completion marks from loaded data.
      this.recomputeCompleted();

      // Pick the default step based on role.
      const role = this.auth.user()?.role ?? UserRole.Clinician;
      this.step.set(defaultStepForRole(role));
    } finally {
      this.loading.set(false);
    }
  }

  reset(): void {
    this.appointment.set(null);
    this.encounter.set(null);
    this.vitals.set(null);
    this.historicalVitals.set([]);
    this.step.set(0);
    this.completed.set(new Array(ENCOUNTER_STEPS.length).fill(false));
    this.saveStatus.set('idle');
    this.lastSavedAt.set(null);
    if (this.savedTimer != null) { clearTimeout(this.savedTimer); this.savedTimer = null; }
  }

  /* ============================================================
     Public: navigation
     ============================================================ */
  goStep(n: number): void {
    if (n < 0 || n >= ENCOUNTER_STEPS.length) return;
    this.step.set(n);
  }
  next(): void { this.goStep(this.step() + 1); }
  prev(): void { this.goStep(this.step() - 1); }

  /* ============================================================
     Public: step 0 — vitals
     ============================================================ */
  /** Patch the in-memory vitals and kick the debounced save. */
  patchVitals(patch: Partial<VitalDto>): void {
    const cur = this.vitals();
    if (!cur) return;
    const merged: VitalDto = { ...cur, ...patch };
    // Auto-compute BMI whenever weight/height change.
    if ('weight' in patch || 'height' in patch) {
      merged.bmi = computeBmi(merged.weight ?? null, merged.height ?? null);
    }
    this.vitals.set(merged);
    this.saveStatus.set('saving');
    this.saveSubject.next('vitals');
  }

  /* ============================================================
     Save plumbing
     ============================================================ */
  private async flush(kind: SaveKind): Promise<void> {
    try {
      if (kind === 'vitals') {
        const v = this.vitals();
        if (!v) return;
        const saved = await this.vitalsApi.save(v);
        if (saved) {
          // merge server echo (e.g. newly assigned vitalId + timestamps)
          this.vitals.set({ ...v, ...saved });
        }
      }
      this.markSaved();
      this.recomputeCompleted();
    } catch (e) {
      this.log.warn('EncounterStore', `flush ${kind} failed`, e);
      this.saveStatus.set('error');
    }
  }

  private markSaved(): void {
    this.saveStatus.set('saved');
    this.lastSavedAt.set(new Date());
    if (this.savedTimer != null) clearTimeout(this.savedTimer);
    this.savedTimer = window.setTimeout(() => {
      if (this.saveStatus() === 'saved') this.saveStatus.set('idle');
    }, 3000);
  }

  private recomputeCompleted(): void {
    const marks = [...this.completed()];
    marks[0] = hasAnyVital(this.vitals());
    // later phases will set marks[1..7] based on their own data
    this.completed.set(marks);
  }

  /* ============================================================
     Encounter bootstrap
     ============================================================ */
  private async ensureEncounter(appt: AppointmentDetailDto): Promise<EncounterDto | null> {
    // If the appointment already surfaces an encounterId, load it.
    if (appt.encounterId != null) {
      const existing = await this.encountersApi.get(appt.patientId, appt.encounterId);
      if (existing) return existing;
    }

    // Otherwise, try listing and matching on appointmentId.
    const all = await this.encountersApi.listForPatient(appt.patientId);
    const found = all.find((e) => e.appointmentId === appt.appointmentId);
    if (found) return found;

    // None exists yet — create one attached to this appointment.
    const providerId = appt.providerId ?? this.auth.user()?.providerId ?? undefined;
    return this.encountersApi.create(appt.patientId, {
      appointmentId: appt.appointmentId,
      patientId: appt.patientId,
      providerId: providerId ?? undefined,
    });
  }
}

function hasAnyVital(v: VitalDto | null): boolean {
  if (!v) return false;
  return [
    v.systolicBp, v.diastolicBp, v.heartRate, v.temperature,
    v.spo2, v.respiratoryRate, v.weight, v.height, v.painScore,
  ].some((x) => x != null);
}
