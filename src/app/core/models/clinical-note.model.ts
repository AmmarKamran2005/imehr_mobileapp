/* ============================================================
   ClinicalNote — mirrors ehr-system/Models/Generated/ClinicalNote.cs
   Note status + type enums come from the server's ClinicalNoteStatus /
   ClinicalNoteType enums. Numeric values are load-bearing.
   ============================================================ */

export enum NoteStatus {
  Draft = 0,
  PendingSignature = 1,
  Signed = 2,
  Amended = 3,
  Finalized = 4,
}

export enum NoteType {
  HAndP = 0,
  SoapNote = 1,
  OfficeVisit = 2,
  Progress = 3,
  Consultation = 4,
  Procedure = 5,
  AnnualWellness = 6,
  Phone = 7,
  Referral = 8,
  LabReview = 9,
}

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  [NoteType.HAndP]:         'H&P',
  [NoteType.SoapNote]:      'SOAP Note',
  [NoteType.OfficeVisit]:   'Office Visit Note',
  [NoteType.Progress]:      'Progress Note',
  [NoteType.Consultation]:  'Consultation Note',
  [NoteType.Procedure]:     'Procedure Note',
  [NoteType.AnnualWellness]:'Annual Wellness Note',
  [NoteType.Phone]:         'Phone Note',
  [NoteType.Referral]:      'Referral Letter',
  [NoteType.LabReview]:     'Lab Review Note',
};

export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  [NoteStatus.Draft]:            'Draft',
  [NoteStatus.PendingSignature]: 'Pending Signature',
  [NoteStatus.Signed]:           'Signed',
  [NoteStatus.Amended]:          'Amended',
  [NoteStatus.Finalized]:        'Finalized',
};

export interface ClinicalNoteDto {
  clinicalNoteId: number;
  patientId: number;
  appointmentId?: number;
  encounterId?: number;
  providerId?: number;
  providerName?: string;

  status: NoteStatus;
  type: NoteType;
  typeName?: string;
  templateName?: string;

  serviceDate?: string;
  htmlContent?: string;
  title?: string;

  signedAt?: string | null;
  signedByUserId?: number | null;

  createdAt?: string;
  updatedAt?: string;
}

/** What the mobile editor works with in memory. */
export interface NoteSections {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export function blankSections(): NoteSections {
  return { subjective: '', objective: '', assessment: '', plan: '' };
}

/* ============================================================
   Round-trip between 4-section UI and HtmlContent.
   We emit a minimal, stable HTML envelope so the backend (which also stores
   rich-text notes from the web Trumbowyg editor) sees a compatible structure.
   ============================================================ */

const SECTION_ORDER: Array<keyof NoteSections> = ['subjective', 'objective', 'assessment', 'plan'];
const SECTION_TITLE: Record<keyof NoteSections, string> = {
  subjective: 'Subjective',
  objective:  'Objective',
  assessment: 'Assessment',
  plan:       'Plan',
};

export function sectionsToHtml(s: NoteSections): string {
  return SECTION_ORDER
    .map((k) => {
      const body = escapeHtml(s[k] ?? '').replace(/\n+/g, '<br>');
      return `<h4>${SECTION_TITLE[k]}</h4><p>${body}</p>`;
    })
    .join('');
}

/**
 * Parse back. Permissive — accepts both the 4-section envelope we emit and
 * anything with a similar structure (h3/h4 headings, separate paragraphs).
 * On parse failure the full HTML lands in Subjective so the clinician can
 * recover what they had rather than losing it.
 */
export function htmlToSections(html: string | null | undefined): NoteSections {
  const base = blankSections();
  if (!html || !html.trim()) return base;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let current: keyof NoteSections | null = null;

    for (const el of Array.from(doc.body.children)) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'h3' || tag === 'h4' || tag === 'h5') {
        const match = SECTION_ORDER.find(
          (k) => SECTION_TITLE[k].toLowerCase() === (el.textContent ?? '').trim().toLowerCase(),
        );
        current = match ?? null;
      } else if (current) {
        base[current] = (base[current] ? base[current] + '\n\n' : '') + textFromNode(el);
      }
    }

    const hasAny = SECTION_ORDER.some((k) => base[k].trim().length > 0);
    if (!hasAny) base.subjective = textFromNode(doc.body);
    return base;
  } catch {
    return { ...blankSections(), subjective: html };
  }
}

function textFromNode(el: Element): string {
  // Preserve simple line breaks; strip tags via textContent.
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  return (clone.textContent ?? '').replace(/\s+\n/g, '\n').trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
