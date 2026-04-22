import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';

import { AppointmentDetailDto } from '../models/appointment.model';
import {
  ENCOUNTER_STEPS, EncounterDto, VitalDto,
  blankVitals, computeBmi,
  defaultStepForRole,
} from '../models/encounter.model';
import {
  AllergyDto, FamilyHistoryDto, HistoryCounts, ImmunizationDto,
  MedicationDto, ProblemDto, SocialHistoryDto,
} from '../models/history.model';
import { UserRole, isClinicianRole } from '../models/user.model';
import {
  ClinicalNoteDto, NoteSections, NoteStatus, NoteType,
  blankSections, htmlToSections, sectionsToHtml,
} from '../models/clinical-note.model';

import { AppointmentsService } from './appointments.service';
import { EncounterService } from './encounter.service';
import { VitalsService } from './vitals.service';
import { PatientHistoryService } from './patient-history.service';
import { ClinicalNotesService } from './clinical-notes.service';
import { AuthService } from '../auth/auth.service';
import { LoggerService } from '../logger/logger.service';
import { ProcessChunkResponse } from '../models/voice.model';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SaveKind = 'vitals' | 'encounter' | 'note';

/**
 * Central reactive store for an ACTIVE encounter session.
 *
 * Lifecycle:
 *   1. EncounterPage calls `enter(appointmentId)` on init.
 *   2. Store loads the appointment → ensures an encounter exists → loads
 *      latest vitals and the six history lists in parallel.
 *   3. Each step component reads/writes through this store.
 *   4. Debounced saves (1.2 s) fire POST/PUT to /vitals or /encounters/{id}
 *      and update the save status strip.
 *   5. The Unified Voice Bar (Phase 4) calls `applyVoiceChunk()` with the
 *      server's extractedData so fields fill in as the user speaks.
 *   6. On exit / logout, `reset()` clears state.
 */
@Injectable({ providedIn: 'root' })
export class EncounterStore {
  private readonly appointmentsApi = inject(AppointmentsService);
  private readonly encountersApi = inject(EncounterService);
  private readonly vitalsApi = inject(VitalsService);
  private readonly historyApi = inject(PatientHistoryService);
  private readonly notesApi = inject(ClinicalNotesService);
  private readonly auth = inject(AuthService);
  private readonly log = inject(LoggerService);

  /* ============================================================
     Signals
     ============================================================ */
  readonly appointment = signal<AppointmentDetailDto | null>(null);
  readonly encounter   = signal<EncounterDto | null>(null);
  readonly vitals      = signal<VitalDto | null>(null);
  readonly historicalVitals = signal<VitalDto[]>([]);

  // History — one signal per sub-section. Components read whichever they need.
  readonly allergies     = signal<AllergyDto[]>([]);
  readonly medications   = signal<MedicationDto[]>([]);
  readonly problems      = signal<ProblemDto[]>([]);
  readonly familyHistory = signal<FamilyHistoryDto[]>([]);
  readonly socialHistory = signal<SocialHistoryDto[]>([]);
  readonly immunizations = signal<ImmunizationDto[]>([]);

  readonly historyCounts = computed<HistoryCounts>(() => ({
    allergies:     this.allergies().length,
    medications:   this.medications().length,
    problems:      this.problems().length,
    familyHistory: this.familyHistory().length,
    socialHistory: this.socialHistory().length,
    immunizations: this.immunizations().length,
  }));

  // Clinical note state (Step 3).
  readonly clinicalNote  = signal<ClinicalNoteDto | null>(null);
  readonly noteType      = signal<NoteType>(NoteType.SoapNote);
  readonly noteSections  = signal<NoteSections>(blankSections());
  /** All notes tied to this appointment — for the "prior notes" chip list. */
  readonly priorNotes    = signal<ClinicalNoteDto[]>([]);

  readonly step = signal<number>(0);
  readonly completed = signal<boolean[]>(new Array(ENCOUNTER_STEPS.length).fill(false));

  readonly loading = signal<boolean>(false);
  readonly saveStatus = signal<SaveStatus>('idle');
  readonly lastSavedAt = signal<Date | null>(null);

  readonly currentStepDef = computed(() => ENCOUNTER_STEPS[this.step()] ?? ENCOUNTER_STEPS[0]);

  /* ============================================================
     Save pipeline — one subject that we filter on kind, so each domain
     debounces independently without collapsing across domains.
     ============================================================ */
  private readonly saveSubject = new Subject<SaveKind>();
  private savedTimer: number | null = null;

  constructor() {
    this.saveSubject.pipe(
      filter((k) => k === 'vitals'),
      debounceTime(1200),
    ).subscribe(() => void this.flushVitals());

    this.saveSubject.pipe(
      filter((k) => k === 'encounter'),
      debounceTime(1200),
    ).subscribe(() => void this.flushEncounter());

    this.saveSubject.pipe(
      filter((k) => k === 'note'),
      debounceTime(1200),
    ).subscribe(() => void this.flushNote());

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
      if (!appt) { this.loading.set(false); return; }

      const enc = await this.ensureEncounter(appt);
      this.encounter.set(enc);

      // Load everything in parallel.
      const [
        vitalsList,
        allergies, medications, problems, family, social, imm,
        notesForAppt,
      ] = await Promise.all([
        this.vitalsApi.list(appt.patientId),
        this.historyApi.listAllergies(appt.patientId),
        this.historyApi.listMedications(appt.patientId),
        this.historyApi.listProblems(appt.patientId),
        this.historyApi.listFamilyHistory(appt.patientId),
        this.historyApi.listSocialHistory(appt.patientId),
        this.historyApi.listImmunizations(appt.patientId),
        this.notesApi.byAppointment(appt.appointmentId),
      ]);

      this.historicalVitals.set(vitalsList);
      const mine = enc
        ? vitalsList.find((v) => v.encounterId === enc.encounterId) ?? null
        : null;
      this.vitals.set(mine ?? blankVitals(appt.patientId, enc?.encounterId ?? null));

      this.allergies.set(allergies);
      this.medications.set(medications);
      this.problems.set(problems);
      this.familyHistory.set(family);
      this.socialHistory.set(social);
      this.immunizations.set(imm);

      // Clinical note — prefer the most recent editable Draft by the current user
      // (or any Draft). Falls back to null so the user starts a fresh note.
      this.priorNotes.set(notesForAppt);
      const uid = this.auth.user()?.userId;
      const editable = notesForAppt.find(
        (n) => n.status === NoteStatus.Draft && (!uid || n.providerId === uid || n.providerId == null),
      ) ?? null;
      if (editable) {
        this.clinicalNote.set(editable);
        this.noteType.set(editable.type);
        this.noteSections.set(htmlToSections(editable.htmlContent));
      } else {
        this.clinicalNote.set(null);
        this.noteType.set(NoteType.SoapNote);
        this.noteSections.set(blankSections());
      }

      this.recomputeCompleted();

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
    this.allergies.set([]);
    this.medications.set([]);
    this.problems.set([]);
    this.familyHistory.set([]);
    this.socialHistory.set([]);
    this.immunizations.set([]);
    this.clinicalNote.set(null);
    this.priorNotes.set([]);
    this.noteType.set(NoteType.SoapNote);
    this.noteSections.set(blankSections());
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
     Public: Step 0 — vitals
     ============================================================ */
  patchVitals(patch: Partial<VitalDto>): void {
    const cur = this.vitals();
    if (!cur) return;
    const merged: VitalDto = { ...cur, ...patch };
    if ('weight' in patch || 'height' in patch) {
      merged.bmi = computeBmi(merged.weight ?? null, merged.height ?? null);
    }
    this.vitals.set(merged);
    this.saveStatus.set('saving');
    this.saveSubject.next('vitals');
  }

  /* ============================================================
     Public: Step 1 — history (6 sub-sections)
     ============================================================ */
  async addAllergy(body: Partial<AllergyDto>): Promise<void> {
    const pid = this.appointment()?.patientId;
    if (!pid) return;
    this.saveStatus.set('saving');
    const created = await this.historyApi.addAllergy(pid, { ...body, patientId: pid });
    if (created) this.allergies.update((list) => [...list, created]);
    this.afterHistoryMutation();
  }
  async removeAllergy(id: number): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const ok = await this.historyApi.removeAllergy(pid, id);
    if (ok) this.allergies.update((list) => list.filter((a) => a.allergyId !== id));
    this.afterHistoryMutation();
  }

  async addMedication(body: Partial<MedicationDto>): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const created = await this.historyApi.addMedication(pid, { ...body, patientId: pid, status: 'Active' });
    if (created) this.medications.update((list) => [...list, created]);
    this.afterHistoryMutation();
  }
  async discontinueMedication(id: number): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const updated = await this.historyApi.discontinueMedication(pid, id);
    if (updated) this.medications.update((list) => list.map((m) => m.medicationId === id ? updated : m));
    this.afterHistoryMutation();
  }
  async removeMedication(id: number): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const ok = await this.historyApi.removeMedication(pid, id);
    if (ok) this.medications.update((list) => list.filter((m) => m.medicationId !== id));
    this.afterHistoryMutation();
  }

  async addProblem(body: Partial<ProblemDto>): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const created = await this.historyApi.addProblem(pid, { ...body, patientId: pid, status: 'Active' });
    if (created) this.problems.update((list) => [...list, created]);
    this.afterHistoryMutation();
  }
  async resolveProblem(id: number): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const updated = await this.historyApi.resolveProblem(pid, id);
    if (updated) this.problems.update((list) => list.map((p) => p.problemId === id ? updated : p));
    this.afterHistoryMutation();
  }
  async removeProblem(id: number): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const ok = await this.historyApi.removeProblem(pid, id);
    if (ok) this.problems.update((list) => list.filter((p) => p.problemId !== id));
    this.afterHistoryMutation();
  }

  async addFamilyHistory(body: Partial<FamilyHistoryDto>): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const created = await this.historyApi.addFamilyHistory(pid, { ...body, patientId: pid });
    if (created) this.familyHistory.update((list) => [...list, created]);
    this.afterHistoryMutation();
  }
  async removeFamilyHistory(id: number): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const ok = await this.historyApi.removeFamilyHistory(pid, id);
    if (ok) this.familyHistory.update((list) => list.filter((f) => f.familyHistoryId !== id));
    this.afterHistoryMutation();
  }

  async addSocialHistory(body: Partial<SocialHistoryDto>): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const created = await this.historyApi.addSocialHistory(pid, { ...body, patientId: pid });
    if (created) this.socialHistory.update((list) => [...list, created]);
    this.afterHistoryMutation();
  }
  async removeSocialHistory(id: number): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const ok = await this.historyApi.removeSocialHistory(pid, id);
    if (ok) this.socialHistory.update((list) => list.filter((s) => s.socialHistoryId !== id));
    this.afterHistoryMutation();
  }

  async addImmunization(body: Partial<ImmunizationDto>): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const created = await this.historyApi.addImmunization(pid, { ...body, patientId: pid });
    if (created) this.immunizations.update((list) => [...list, created]);
    this.afterHistoryMutation();
  }
  async removeImmunization(id: number): Promise<void> {
    const pid = this.appointment()?.patientId; if (!pid) return;
    this.saveStatus.set('saving');
    const ok = await this.historyApi.removeImmunization(pid, id);
    if (ok) this.immunizations.update((list) => list.filter((i) => i.immunizationId !== id));
    this.afterHistoryMutation();
  }

  private afterHistoryMutation(): void {
    this.markSaved();
    this.recomputeCompleted();
  }

  /* ============================================================
     Public: Step 2 — CC & HPI (on the encounter row)
     ============================================================ */
  patchCcHpi(patch: Partial<Pick<EncounterDto, 'chiefComplaint' | 'historyOfPresentIllness'>>): void {
    const cur = this.encounter();
    if (!cur) return;
    this.encounter.set({ ...cur, ...patch });
    this.saveStatus.set('saving');
    this.saveSubject.next('encounter');
  }

  /* ============================================================
     Public: Step 3 — clinical note
     ============================================================ */
  canEditNote(): boolean {
    const r = this.auth.user()?.role;
    return r != null && isClinicianRole(r);
  }

  setNoteType(t: NoteType): void {
    if (this.noteType() === t) return;
    this.noteType.set(t);
    this.saveStatus.set('saving');
    this.saveSubject.next('note');
  }

  patchNote(patch: Partial<NoteSections>): void {
    if (!this.canEditNote()) return;
    const cur = this.noteSections();
    const merged = { ...cur, ...patch };
    this.noteSections.set(merged);
    this.saveStatus.set('saving');
    this.saveSubject.next('note');
  }

  /* ============================================================
     Public: Voice Bar hook — called by VoiceService per chunk.
     ============================================================ */
  applyVoiceChunk(resp: ProcessChunkResponse): void {
    const d = resp.extractedData;
    if (!d || typeof d !== 'object') return;

    // Vitals extraction
    const vitalKeys: Array<keyof VitalDto> = [
      'systolicBp', 'diastolicBp', 'heartRate', 'temperature',
      'spo2', 'respiratoryRate', 'weight', 'height', 'painScore',
    ];
    const vitalsPatch: Partial<VitalDto> = {};
    for (const k of vitalKeys) {
      const v = (d as Record<string, unknown>)[k as string] ??
                (d as Record<string, unknown>)[toTitle(k as string)];
      if (typeof v === 'number') (vitalsPatch as Record<string, number>)[k as string] = v;
    }
    if (Object.keys(vitalsPatch).length > 0) this.patchVitals(vitalsPatch);

    // CC / HPI extraction
    const cc = stringOrNull((d as Record<string, unknown>)['chiefComplaint']) ??
               stringOrNull((d as Record<string, unknown>)['ChiefComplaint']);
    const hpi = stringOrNull((d as Record<string, unknown>)['historyOfPresentIllness']) ??
                stringOrNull((d as Record<string, unknown>)['HistoryOfPresentIllness']) ??
                stringOrNull((d as Record<string, unknown>)['hpi']);
    const patch: Partial<Pick<EncounterDto, 'chiefComplaint' | 'historyOfPresentIllness'>> = {};
    if (cc != null)  patch.chiefComplaint = cc;
    if (hpi != null) patch.historyOfPresentIllness = hpi;
    if (Object.keys(patch).length > 0) this.patchCcHpi(patch);

    // Clinical note (tabKey='note') extraction — either per-section fields or
    // a full htmlContent drafted by the server.
    const raw = d as Record<string, unknown>;
    const notePatch: Partial<NoteSections> = {};
    for (const key of ['subjective', 'objective', 'assessment', 'plan'] as const) {
      const v = raw[key] ?? raw[toTitle(key)];
      if (typeof v === 'string' && v.trim().length > 0) notePatch[key] = v;
    }
    const draftedHtml = stringOrNull(raw['htmlContent']) ?? stringOrNull(raw['HtmlContent']);
    if (draftedHtml) {
      const parsed = htmlToSections(draftedHtml);
      if (!notePatch.subjective  && parsed.subjective)  notePatch.subjective  = parsed.subjective;
      if (!notePatch.objective   && parsed.objective)   notePatch.objective   = parsed.objective;
      if (!notePatch.assessment  && parsed.assessment)  notePatch.assessment  = parsed.assessment;
      if (!notePatch.plan        && parsed.plan)        notePatch.plan        = parsed.plan;
    }
    if (Object.keys(notePatch).length > 0 && this.canEditNote()) {
      this.patchNote(notePatch);
    }
  }

  /* ============================================================
     Flush logic
     ============================================================ */
  private async flushVitals(): Promise<void> {
    try {
      const v = this.vitals();
      if (!v) return;
      const saved = await this.vitalsApi.save(v);
      if (saved) this.vitals.set({ ...v, ...saved });
      this.markSaved();
      this.recomputeCompleted();
    } catch (e) {
      this.log.warn('EncounterStore', 'flushVitals failed', e);
      this.saveStatus.set('error');
    }
  }

  private async flushNote(): Promise<void> {
    if (!this.canEditNote()) return;
    try {
      const appt = this.appointment();
      const enc  = this.encounter();
      if (!appt) return;

      const html = sectionsToHtml(this.noteSections());
      const existing = this.clinicalNote();

      if (existing) {
        const updated = await this.notesApi.update(existing.clinicalNoteId, {
          htmlContent: html,
          type: this.noteType(),
        });
        if (updated) this.clinicalNote.set({ ...existing, ...updated });
      } else {
        // Don't POST a totally empty note.
        if (!hasAnyNoteContent(this.noteSections())) {
          this.saveStatus.set('idle');
          return;
        }
        const created = await this.notesApi.create({
          patientId: appt.patientId,
          appointmentId: appt.appointmentId,
          encounterId: enc?.encounterId,
          providerId: appt.providerId ?? this.auth.user()?.providerId ?? undefined,
          type: this.noteType(),
          status: NoteStatus.Draft,
          htmlContent: html,
        });
        if (created) {
          this.clinicalNote.set(created);
          this.priorNotes.update((list) => [created, ...list]);
        }
      }
      this.markSaved();
      this.recomputeCompleted();
    } catch (e) {
      this.log.warn('EncounterStore', 'flushNote failed', e);
      this.saveStatus.set('error');
    }
  }

  private async flushEncounter(): Promise<void> {
    try {
      const enc = this.encounter();
      const appt = this.appointment();
      if (!enc || !appt) return;
      const saved = await this.encountersApi.update(appt.patientId, enc.encounterId, {
        chiefComplaint: enc.chiefComplaint,
        historyOfPresentIllness: enc.historyOfPresentIllness,
      });
      if (saved) this.encounter.set({ ...enc, ...saved });
      this.markSaved();
      this.recomputeCompleted();
    } catch (e) {
      this.log.warn('EncounterStore', 'flushEncounter failed', e);
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
    marks[1] = this.hasAnyHistory();
    marks[2] = !!(this.encounter()?.chiefComplaint) || !!(this.encounter()?.historyOfPresentIllness);
    marks[3] = !!this.clinicalNote() || hasAnyNoteContent(this.noteSections());
    // marks[4..7] — later phases
    this.completed.set(marks);
  }

  private hasAnyHistory(): boolean {
    const c = this.historyCounts();
    return (c.allergies + c.medications + c.problems + c.familyHistory + c.socialHistory + c.immunizations) > 0;
  }

  /* ============================================================
     Encounter bootstrap
     ============================================================ */
  private async ensureEncounter(appt: AppointmentDetailDto): Promise<EncounterDto | null> {
    if (appt.encounterId != null) {
      const existing = await this.encountersApi.get(appt.patientId, appt.encounterId);
      if (existing) return existing;
    }
    const all = await this.encountersApi.listForPatient(appt.patientId);
    const found = all.find((e) => e.appointmentId === appt.appointmentId);
    if (found) return found;
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

function hasAnyNoteContent(s: NoteSections): boolean {
  return (s.subjective + s.objective + s.assessment + s.plan).trim().length > 0;
}

function stringOrNull(x: unknown): string | null {
  return typeof x === 'string' && x.trim().length > 0 ? x : null;
}

function toTitle(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
