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

  /**
   * IANA timezone of the appointment's location (e.g. "America/Chicago").
   * The web serializes appointment DateTimes without a zone indicator and
   * relies on this field for correct display. Mobile does the same so that
   * an appointment created at 2:30 PM Chicago time shows as 2:30 PM
   * regardless of where the viewing device is located.
   */
  timeZoneId?: string;
  /** User-friendly zone label, e.g. "CDT", "EST". */
  timeZoneAbbreviation?: string;
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

/**
 * Format an ISO datetime as 12-hour wall-clock time. Pass the appointment's
 * `timeZoneId` to render in that zone regardless of the device zone — this
 * matches the web and avoids the "2:30 PM appointment shows as 7:30 PM on
 * my phone" bug caused by the server returning a UTC instant without the Z
 * suffix, or a local-kind DateTime that JS Date parses ambiguously.
 *
 * If `timeZoneId` is absent, falls back to the device's local zone.
 */
export function formatTime12(iso: string, timeZoneId?: string): { hour: string; mer: 'AM' | 'PM' } {
  const d = parseServerIso(iso);
  if (!d) return { hour: '--:--', mer: 'AM' };
  try {
    const opts: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...(timeZoneId ? { timeZone: timeZoneId } : {}),
    };
    // en-US gives us the predictable "02:30 PM" shape the UI expects.
    const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(d);
    const hour   = parts.find((p) => p.type === 'hour')?.value ?? '--';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '--';
    const period = (parts.find((p) => p.type === 'dayPeriod')?.value ?? 'AM').toUpperCase();
    return { hour: `${hour}:${minute}`, mer: period === 'PM' ? 'PM' : 'AM' };
  } catch {
    // Invalid zone fallback — device local.
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const mer: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return { hour: `${h.toString().padStart(2, '0')}:${m}`, mer };
  }
}

/** Format a datetime as a date like "Thu, May 1" in the given zone. */
export function formatDateShort(iso: string, timeZoneId?: string): string {
  const d = parseServerIso(iso);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(timeZoneId ? { timeZone: timeZoneId } : {}),
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Parse what the IMEHR backend serializes.
 *
 * Replicates the web's `parseServerDateTime` helper (see
 * ehr-system/wwwroot/js/core/GlobalBridge.js) which documents the quirk:
 *
 *   "Use parseServerDateTime to correctly interpret server UTC times
 *    (handles missing 'Z' suffix)"
 *
 * The server stores appointment times in UTC but System.Text.Json
 * serializes them WITHOUT a 'Z' suffix. If the mobile app parses them
 * raw, `new Date("2026-04-23T19:30:00")` interprets the string as LOCAL
 * time, pushing a 2:30 PM CDT appointment to display as 7:30 PM on a
 * device in Chicago (the exact bug reported). Appending 'Z' before
 * parsing forces UTC interpretation, then Intl.DateTimeFormat with the
 * appointment's `timeZoneId` renders the correct wall-clock time.
 *
 * Rules, in order:
 *   • DateOnly strings (YYYY-MM-DD) → local midnight (Kind.Unspecified)
 *   • Has 'Z' or numeric offset → parse as-is (already zoned)
 *   • Otherwise → assume UTC, append 'Z'
 */
function parseServerIso(iso: string): Date | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const zoned = iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso);
  const d = new Date(zoned ? iso : iso + 'Z');
  return isNaN(d.getTime()) ? null : d;
}
