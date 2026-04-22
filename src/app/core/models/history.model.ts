/* ============================================================
   Patient history — DTOs shared by the 6 sub-sections in
   EncounterWorkspaceModule._renderHistoryStep().
   Names mirror the server DTOs on PatientAllergy/Medication/etc.
   ============================================================ */

export interface AllergyDto {
  allergyId?: number;
  patientId: number;
  allergen: string;
  severity?: 'Mild' | 'Moderate' | 'Severe' | string;
  reaction?: string;
  status?: 'Active' | 'Inactive';
  notes?: string;
  recordedAt?: string;
}

export interface MedicationDto {
  medicationId?: number;
  patientId: number;
  name: string;                       // "Lisinopril 10 mg tablet"
  dose?: string;                      // "10 mg"
  route?: string;                     // "PO"
  frequency?: string;                 // "daily", "BID"
  startedAt?: string;                 // ISO date
  endedAt?: string;
  status?: 'Active' | 'Discontinued';
  notes?: string;
}

export interface ProblemDto {
  problemId?: number;
  patientId: number;
  description: string;
  icd10Code?: string;
  onsetDate?: string;
  resolvedDate?: string | null;
  status?: 'Active' | 'Resolved' | 'Inactive';
  notes?: string;
}

export interface FamilyHistoryDto {
  familyHistoryId?: number;
  patientId: number;
  relationship: string;              // Mother / Father / Sibling
  conditions: string;                // free text "HTN, T2DM"
  notes?: string;
}

/**
 * Social history is tag/value shaped on the web (Tobacco · Never, etc.).
 * We represent each entry as one row so it maps to the PatientSocialHistory table.
 */
export interface SocialHistoryDto {
  socialHistoryId?: number;
  patientId: number;
  category: 'Tobacco' | 'Alcohol' | 'Drugs' | 'Exercise' | 'Diet' | 'Occupation' | string;
  value: string;
  notes?: string;
}

export interface ImmunizationDto {
  immunizationId?: number;
  patientId: number;
  vaccine: string;                   // "Influenza", "COVID-19", "Tdap"
  administeredAt?: string;
  lot?: string;
  notes?: string;
  status?: 'Completed' | 'Pending' | 'Refused';
}

/* Counter types handy for the step's "(count)" headers and the step-completion
   heuristic (a step is "done" if at least one item exists in any category). */
export interface HistoryCounts {
  allergies: number;
  medications: number;
  problems: number;
  familyHistory: number;
  socialHistory: number;
  immunizations: number;
}
