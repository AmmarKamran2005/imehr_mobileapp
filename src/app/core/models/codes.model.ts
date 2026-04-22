/* ============================================================
   ICD-10 / CPT code models + AI suggestion shapes.
   Source: rules/technical/dx-and-cpt-codes.md + backend controllers.
   ============================================================ */

export interface IcdCode {
  code: string;                  // "E11.65"
  description: string;
  aiSuggested?: boolean;
  rationale?: string;
  confidence?: number;           // 0–100
}

export interface CptCode {
  cptCode: string;               // "99214"
  description: string;
  units?: number;                // default 1
  rationale?: string;
  aiSuggested?: boolean;
  confidence?: number;
}

/** Response shape from POST /api/appointments/{id}/suggest-icd */
export interface IcdSuggestionResponse {
  suggestions: IcdCode[];
  generatedAt?: string;
}

/** Response shape from POST /api/appointments/{id}/suggest-cpt */
export interface CptSuggestionResponse {
  suggestions: CptCode[];
  generatedAt?: string;
}

/** Per-user favorites row (GET /api/favorites?type=...). */
export interface FavoriteCode {
  favoriteId?: number;
  codeType: 'ICD10' | 'CPT';
  code: string;
  description: string;
}

/* ============================================================
   Constraints — CMS-1500 Box 21 allows max 12 ICDs.
   Confidence buckets per rules/technical/dx-and-cpt-codes.md.
   ============================================================ */
export const ICD_MAX = 12;

export function confidenceBucket(c: number | undefined | null): 'high' | 'medium' | 'low' {
  if (c == null) return 'low';
  if (c >= 90) return 'high';
  if (c >= 60) return 'medium';
  return 'low';
}

/** ICD-10 priority letter A…L — position = index. */
export function priorityLetter(i: number): string {
  return String.fromCharCode(65 + i);   // 0→A, 1→B …
}

/** 3-char family prefix for the E78.x-style family overlay. */
export function familyPrefix(code: string): string {
  const dot = code.indexOf('.');
  return dot > 0 ? code.slice(0, dot) : code;
}
