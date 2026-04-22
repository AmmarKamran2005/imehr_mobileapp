/**
 * Mirrors ehr-system/Models/Enums/AllEnums.cs (AppointmentStatus).
 * The numeric values are load-bearing — the backend persists them as ints
 * and the mobile UI must not diverge.
 */
export enum AppointmentStatus {
  Scheduled = 0,
  Confirmed = 1,
  CheckedIn = 2,
  InProgress = 3,
  Completed = 4,
  NoShow = 5,
  Cancelled = 6,
  Rescheduled = 7,
  Missed = 8,
}

/**
 * Appointment types from AppointmentModule.js on the web.
 * Display strings only — the server stores an int.
 */
export const APPOINTMENT_TYPE_LABELS: Record<number, string> = {
  0: 'New Patient',
  1: 'Follow-Up',
  2: 'Annual Physical',
  3: 'Wellness',
  4: 'Consultation',
  5: 'Telehealth',
  6: 'Procedure',
  7: 'Urgent',
  8: 'Lab Review',
  9: 'Med Review',
};

/**
 * Shape returned by /api/dashboard/appointments and /api/appointments?patientId=...
 * Field names match the DashboardAppointmentDto / AppointmentListDto on the server.
 * Optional fields are defensive — different endpoints project different columns.
 */
export interface AppointmentDto {
  appointmentId: number;
  patientId: number;
  patientName?: string;
  patientMrn?: string;
  patientInitials?: string;

  providerId?: number;
  providerName?: string;

  locationId?: number;
  locationName?: string;
  roomNumber?: string;

  startTime: string;          // ISO datetime
  endTime?: string;

  status: AppointmentStatus;
  type?: number;              // AppointmentType enum int
  typeName?: string;

  reason?: string;
  notes?: string;

  // telehealth
  isTelehealth?: boolean;
  telehealthUrl?: string;

  // documentation hints the server may include on dashboard payloads
  hasSignedNote?: boolean;
  hasDraftNote?: boolean;
  consentSigned?: boolean;
  eligibilityVerified?: boolean;

  checkedInAt?: string;
  startedAt?: string;
  completedAt?: string;
}

/** Full patient-chart detail returned by /api/appointments/{id}. */
export interface AppointmentDetailDto extends AppointmentDto {
  patientDob?: string;
  patientGender?: string;
  patientPhone?: string;
  patientEmail?: string;

  insurancePayer?: string;
  insuranceMemberId?: string;

  encounterId?: number | null;
}

/** Displayable appearance for each status. */
export interface StatusMeta {
  label: string;
  chipClass: 'chip-primary' | 'chip-info' | 'chip-warning' | 'chip-success' | 'chip-danger' | 'chip-neutral';
  /** Which action button the card should render. */
  action: 'check-in' | 'start' | 'resume' | 'view' | 'none';
}

export function statusMeta(s: AppointmentStatus): StatusMeta {
  switch (s) {
    case AppointmentStatus.Scheduled:  return { label: 'Scheduled',   chipClass: 'chip-primary', action: 'check-in' };
    case AppointmentStatus.Confirmed:  return { label: 'Confirmed',   chipClass: 'chip-info',    action: 'check-in' };
    case AppointmentStatus.CheckedIn:  return { label: 'Checked In',  chipClass: 'chip-info',    action: 'start' };
    case AppointmentStatus.InProgress: return { label: 'In Progress', chipClass: 'chip-warning', action: 'resume' };
    case AppointmentStatus.Completed:  return { label: 'Completed',   chipClass: 'chip-success', action: 'view' };
    case AppointmentStatus.NoShow:     return { label: 'No Show',     chipClass: 'chip-danger',  action: 'none' };
    case AppointmentStatus.Cancelled:  return { label: 'Cancelled',   chipClass: 'chip-neutral', action: 'none' };
    case AppointmentStatus.Rescheduled:return { label: 'Rescheduled', chipClass: 'chip-neutral', action: 'none' };
    case AppointmentStatus.Missed:     return { label: 'Missed',      chipClass: 'chip-danger',  action: 'none' };
    default:                           return { label: 'Unknown',     chipClass: 'chip-neutral', action: 'none' };
  }
}

export function initialsFromName(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function formatTime12(iso: string): { hour: string; mer: 'AM' | 'PM' } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { hour: '--:--', mer: 'AM' };
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const mer: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return { hour: `${h.toString().padStart(2, '0')}:${m}`, mer };
}
