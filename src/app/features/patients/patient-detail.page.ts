import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';

import { PatientsService, PatientDetailDto, patientInitials, patientStatusLabel } from 'src/app/core/services/patients.service';
import { PatientHistoryService } from 'src/app/core/services/patient-history.service';
import { VitalsService } from 'src/app/core/services/vitals.service';
import { ClinicalNotesService } from 'src/app/core/services/clinical-notes.service';

import {
  AllergyDto, FamilyHistoryDto, ImmunizationDto,
  MedicationDto, ProblemDto, SocialHistoryDto,
} from 'src/app/core/models/history.model';
import { VitalDto } from 'src/app/core/models/encounter.model';
import { ClinicalNoteDto, NOTE_STATUS_LABELS, NOTE_TYPE_LABELS, NoteStatus } from 'src/app/core/models/clinical-note.model';

import { LoggerService } from 'src/app/core/logger/logger.service';

type TabKey =
  | 'overview' | 'problems' | 'medications' | 'allergies' | 'vitals'
  | 'immunizations' | 'history' | 'insurance' | 'encounters'
  | 'prescriptions' | 'orders' | 'attachments' | 'consent'
  | 'appt-notes' | 'finance';

interface TabDef { key: TabKey; label: string; icon: string; }

const TABS: readonly TabDef[] = [
  { key: 'overview',      label: 'Overview',      icon: 'person-circle-outline' },
  { key: 'problems',      label: 'Problems',      icon: 'list-outline' },
  { key: 'medications',   label: 'Medications',   icon: 'medkit-outline' },
  { key: 'allergies',     label: 'Allergies',     icon: 'warning-outline' },
  { key: 'vitals',        label: 'Vitals',        icon: 'pulse-outline' },
  { key: 'immunizations', label: 'Immunizations', icon: 'shield-checkmark-outline' },
  { key: 'history',       label: 'History',       icon: 'people-outline' },
  { key: 'insurance',     label: 'Insurance',     icon: 'card-outline' },
  { key: 'encounters',    label: 'Encounters',    icon: 'briefcase-outline' },
  { key: 'appt-notes',    label: 'Appt / Notes',  icon: 'calendar-number-outline' },
  { key: 'orders',        label: 'Orders',        icon: 'clipboard-outline' },
  { key: 'attachments',   label: 'Attachments',   icon: 'attach-outline' },
  { key: 'consent',       label: 'Consent',       icon: 'document-lock-outline' },
  { key: 'finance',       label: 'Finance',       icon: 'wallet-outline' },
];

/**
 * Patient chart — horizontal tab strip with 14 tabs mirroring the web's
 * `_ModalsAppointment` / `PatientRenderer.renderDetailModal()` tab set
 * (Prescriptions dropped, same as the encounter wizard).
 *
 * Tabs with fully implemented content: Overview, Problems, Medications,
 * Allergies, Vitals, Immunizations, History, Encounters/Notes, Appt / Notes.
 * Others render a "Coming soon" panel until later polish.
 */
@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonSpinner,
  ],
  templateUrl: './patient-detail.page.html',
  styleUrls: ['./patient-detail.page.scss'],
})
export class PatientDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly patientsApi = inject(PatientsService);
  private readonly historyApi = inject(PatientHistoryService);
  private readonly vitalsApi = inject(VitalsService);
  private readonly notesApi = inject(ClinicalNotesService);
  private readonly log = inject(LoggerService);

  readonly tabs = TABS;

  readonly patientId = signal<number | null>(null);
  readonly patient = signal<PatientDetailDto | null>(null);
  readonly loading = signal<boolean>(true);
  readonly currentTab = signal<TabKey>('overview');

  // Per-tab data
  readonly problems      = signal<ProblemDto[]>([]);
  readonly medications   = signal<MedicationDto[]>([]);
  readonly allergies     = signal<AllergyDto[]>([]);
  readonly vitals        = signal<VitalDto[]>([]);
  readonly immunizations = signal<ImmunizationDto[]>([]);
  readonly familyHx      = signal<FamilyHistoryDto[]>([]);
  readonly socialHx      = signal<SocialHistoryDto[]>([]);
  readonly notes         = signal<ClinicalNoteDto[]>([]);

  readonly initials = computed(() => patientInitials(this.patient()));
  readonly statusChip = computed(() => patientStatusLabel(this.patient()?.status));
  readonly displayName = computed(() => {
    const p = this.patient();
    if (!p) return 'Patient';
    return p.fullName ?? [p.firstName, p.lastName].filter(Boolean).join(' ') ?? 'Patient';
  });

  readonly latestVital = computed(() => {
    const arr = this.vitals();
    if (arr.length === 0) return null;
    return arr.reduce((latest, cur) => {
      const lt = latest.recordedAt ? Date.parse(latest.recordedAt) : 0;
      const ct = cur.recordedAt ? Date.parse(cur.recordedAt) : 0;
      return ct > lt ? cur : latest;
    }, arr[0]);
  });

  readonly activeProblems = computed(() => this.problems().filter((p) => p.status !== 'Resolved'));
  readonly activeMeds     = computed(() => this.medications().filter((m) => m.status !== 'Discontinued'));
  readonly primaryInsurance = computed(() => this.patient()?.insurances?.find((i) => i.type === 'Primary') ?? null);

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      await this.router.navigate(['/tabs/patients']);
      return;
    }
    this.patientId.set(id);
    await this.loadAll(id);
  }

  private async loadAll(id: number): Promise<void> {
    this.loading.set(true);
    try {
      const [p, problems, medications, allergies, vitals, immunizations, family, social, notes] = await Promise.all([
        this.patientsApi.get(id),
        this.historyApi.listProblems(id),
        this.historyApi.listMedications(id),
        this.historyApi.listAllergies(id),
        this.vitalsApi.list(id),
        this.historyApi.listImmunizations(id),
        this.historyApi.listFamilyHistory(id),
        this.historyApi.listSocialHistory(id),
        this.notesApi.list(id),
      ]);
      this.patient.set(p);
      this.problems.set(problems);
      this.medications.set(medications);
      this.allergies.set(allergies);
      this.vitals.set(vitals);
      this.immunizations.set(immunizations);
      this.familyHx.set(family);
      this.socialHx.set(social);
      this.notes.set(notes);
    } catch (e) {
      this.log.warn('PatientDetail', 'loadAll failed', e);
    } finally {
      this.loading.set(false);
    }
  }

  pickTab(t: TabKey): void { this.currentTab.set(t); }
  back(): void { void this.router.navigate(['/tabs/patients']); }

  addressLine(p: PatientDetailDto): string {
    return [p.city, p.state, p.zipCode].filter((s) => !!s).join(', ');
  }

  noteStatusLabel(s: NoteStatus): string { return NOTE_STATUS_LABELS[s] ?? String(s); }
  noteTypeLabel(t: number): string { return NOTE_TYPE_LABELS[t as NoteStatus] ?? 'Note'; }
}
