import { UserRole, isNurseRole } from './user.model';

/**
 * Encounter status mirrors the server enum (Encounter.Status int field).
 * Values inferred from ehr-system/Models/Generated/Encounter.cs.
 */
export enum EncounterStatus {
  Open = 0,
  Signed = 1,
  Locked = 2,
  Amended = 3,
}

/** Shape returned by /api/patients/{pid}/encounters/{id}. */
export interface EncounterDto {
  encounterId: number;
  patientId: number;
  appointmentId?: number;
  providerId?: number;
  status: EncounterStatus;

  // Owned by step 2
  chiefComplaint?: string | null;
  historyOfPresentIllness?: string | null;

  // Owned by step 6 — JSON arrays on the server
  icdSelections?: IcdSelection[] | null;
  cptSelections?: CptSelection[] | null;

  createdAt?: string;
  updatedAt?: string;
  signedAt?: string | null;
  checkoutTime?: string | null;
}

export interface IcdSelection {
  code: string;
  description?: string;
  aiSuggested?: boolean;
}

export interface CptSelection {
  cptCode: string;
  description?: string;
  units?: number;
  rationale?: string;
  aiSuggested?: boolean;
}

/**
 * Vitals — mirrors PatientVital generated model + PatientVitalsController DTO.
 * All units US customary (lbs, inches, °F).
 */
export interface VitalDto {
  vitalId?: number;
  patientId: number;
  encounterId?: number | null;
  recordedAt?: string;

  systolicBp?: number | null;
  diastolicBp?: number | null;
  heartRate?: number | null;
  temperature?: number | null;   // °F
  spo2?: number | null;          // %
  respiratoryRate?: number | null;
  weight?: number | null;        // lbs
  height?: number | null;        // inches
  bmi?: number | null;
  painScore?: number | null;     // 0–10
}

export function blankVitals(patientId: number, encounterId?: number | null): VitalDto {
  return {
    patientId,
    encounterId: encounterId ?? null,
    systolicBp: null,
    diastolicBp: null,
    heartRate: null,
    temperature: null,
    spo2: null,
    respiratoryRate: null,
    weight: null,
    height: null,
    bmi: null,
    painScore: null,
  };
}

/**
 * BMI = (weight_lbs / height_in^2) * 703.
 * Returns null when either input is missing or out of safe range.
 */
export function computeBmi(weightLbs: number | null | undefined, heightIn: number | null | undefined): number | null {
  if (weightLbs == null || heightIn == null) return null;
  if (weightLbs <= 0 || heightIn <= 0) return null;
  const bmi = (weightLbs / (heightIn * heightIn)) * 703;
  if (!isFinite(bmi)) return null;
  return Math.round(bmi * 10) / 10;
}

/* ============================================================
   Step definitions — EXACT labels used by the web sidebar.
   Source: ehr-system/wwwroot/js/modules/encounters/EncounterWorkspaceModule.js
   line ~23-33 (the 8-element step array).
   ============================================================ */

export type StepKey =
  | 'vitals' | 'history' | 'cc-hpi' | 'note'
  | 'orders' | 'prescriptions' | 'dx-cpt' | 'checkout';

export interface StepDef {
  index: number;
  key: StepKey;
  label: string;
  owner: 'nurse' | 'clinician';
  hasVoiceBar: boolean;  // Unified Voice Bar shows on steps 0-2 only
  icon: string;
}

export const ENCOUNTER_STEPS: readonly StepDef[] = [
  { index: 0, key: 'vitals',        label: 'Vitals',             owner: 'nurse',     hasVoiceBar: true,  icon: 'pulse-outline' },
  { index: 1, key: 'history',       label: 'History Review',     owner: 'nurse',     hasVoiceBar: true,  icon: 'people-outline' },
  { index: 2, key: 'cc-hpi',        label: 'CC & HPI',           owner: 'nurse',     hasVoiceBar: true,  icon: 'chatbubble-ellipses-outline' },
  { index: 3, key: 'note',          label: 'Clinical Note',      owner: 'clinician', hasVoiceBar: false, icon: 'document-text-outline' },
  { index: 4, key: 'orders',        label: 'Orders & Referrals', owner: 'clinician', hasVoiceBar: false, icon: 'clipboard-outline' },
  { index: 5, key: 'prescriptions', label: 'Prescriptions',      owner: 'clinician', hasVoiceBar: false, icon: 'medkit-outline' },
  { index: 6, key: 'dx-cpt',        label: 'Dx & CPT Codes',     owner: 'clinician', hasVoiceBar: false, icon: 'pricetags-outline' },
  { index: 7, key: 'checkout',      label: 'Checkout',           owner: 'clinician', hasVoiceBar: false, icon: 'checkmark-circle-outline' },
];

export function defaultStepForRole(role: UserRole): number {
  return isNurseRole(role) ? 0 : 3;
}

export function isStepLocked(step: StepDef, role: UserRole): boolean {
  if (isNurseRole(role)) return step.owner === 'clinician';
  return false;
}
