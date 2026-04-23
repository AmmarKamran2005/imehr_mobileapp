import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

import { environment } from 'src/environments/environment';
import { AppointmentDto } from '../models/appointment.model';
import {
  DashboardAppointmentsResponse, DashboardStats,
} from '../models/dashboard.model';
import { LoggerService } from '../logger/logger.service';

/**
 * Wraps /api/dashboard/* and the broader /api/appointments range endpoint.
 *
 *   /api/dashboard/appointments — TODAY only, server-computed in the
 *     location's timezone. Returns a DashboardAppointmentsDto wrapper with
 *     counts. This is what the web dashboard uses and what we use on the
 *     mobile "today" view.
 *
 *   /api/appointments?startDate=&endDate=&providerId= — range query used
 *     when the user picks a different day on the date strip. Returns a
 *     flat array of AppointmentListDto.
 *
 *   /api/dashboard/stats — top stat cards.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  /* ============================================================
     Today (the dashboard endpoint)
     ============================================================ */

  todayAppointments(providerId?: number, locationId?: number): Observable<AppointmentDto[]> {
    let params = new HttpParams();
    if (providerId != null) params = params.set('providerId', String(providerId));
    if (locationId != null) params = params.set('locationId', String(locationId));

    return this.http
      .get<DashboardAppointmentsResponse | AppointmentDto[]>(
        `${this.base}/api/dashboard/appointments`,
        { params },
      )
      .pipe(
        map((resp) => Array.isArray(resp) ? resp : (resp?.appointments ?? [])),
        catchError((e) => {
          this.log.warn('Dashboard', 'todayAppointments failed', e);
          return of<AppointmentDto[]>([]);
        }),
      );
  }

  /** Used by auto-refresh when we want the full wrapper (counts + rows). */
  todayDashboardBundle(providerId?: number, locationId?: number): Observable<DashboardAppointmentsResponse> {
    let params = new HttpParams();
    if (providerId != null) params = params.set('providerId', String(providerId));
    if (locationId != null) params = params.set('locationId', String(locationId));
    return this.http
      .get<DashboardAppointmentsResponse>(
        `${this.base}/api/dashboard/appointments`, { params },
      )
      .pipe(
        catchError((e) => {
          this.log.warn('Dashboard', 'todayDashboardBundle failed', e);
          return of<DashboardAppointmentsResponse>({
            appointments: [], waitingForCheckInCount: 0,
            missingNotesCount: 0, requiresSignatureCount: 0, totalCount: 0,
          });
        }),
      );
  }

  /* ============================================================
     Any specific day (range endpoint)
     ============================================================ */

  /**
   * Pick a calendar day → returns appointments that fall inside
   * [date 00:00 … date+1 00:00). Uses /api/appointments?startDate=&endDate=.
   * providerId is optional; pass the clinician's own id to scope the list
   * (matches how the web filters for non-admin roles).
   */
  appointmentsForDay(date: Date, opts: { providerId?: number; locationId?: number } = {}): Observable<AppointmentDto[]> {
    const start = startOfDayIso(date);
    const end   = startOfDayIso(addDays(date, 1));

    let params = new HttpParams()
      .set('startDate', start)
      .set('endDate',   end);
    if (opts.providerId != null) params = params.set('providerId', String(opts.providerId));
    if (opts.locationId != null) params = params.set('locationId', String(opts.locationId));

    return this.http
      .get<AppointmentDto[] | { items?: AppointmentDto[]; appointments?: AppointmentDto[] }>(
        `${this.base}/api/appointments`,
        { params },
      )
      .pipe(
        map((resp) => {
          if (Array.isArray(resp)) return resp;
          if (resp && typeof resp === 'object') {
            return (resp as { items?: AppointmentDto[]; appointments?: AppointmentDto[] }).items
              ?? (resp as { items?: AppointmentDto[]; appointments?: AppointmentDto[] }).appointments
              ?? [];
          }
          return [];
        }),
        catchError((e) => {
          this.log.warn('Dashboard', 'appointmentsForDay failed', e);
          return of<AppointmentDto[]>([]);
        }),
      );
  }

  /* ============================================================
     Stats
     ============================================================ */

  stats(): Observable<DashboardStats> {
    return this.http
      .get<DashboardStats>(`${this.base}/api/dashboard/stats`)
      .pipe(
        catchError((e) => {
          this.log.warn('Dashboard', 'stats failed', e);
          return of<DashboardStats>({
            todayAppointments: 0,
            completedToday: 0,
            pendingNotes: 0,
            todayCollections: 0,
            activePatients: 0,
            totalPatients: 0,
            outstandingAr: 0,
            authorizationsExpiringSoon: 0,
            noShowsToday: 0,
            claimsPending: 0,
          });
        }),
      );
  }
}

/* ============================================================
   Helpers
   ============================================================ */
function startOfDayIso(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // Send as ISO so the server's [FromQuery] DateTime binding is unambiguous.
  return x.toISOString();
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
