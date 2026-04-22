import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

import { environment } from 'src/environments/environment';
import { AppointmentDto } from '../models/appointment.model';
import { DashboardStats } from '../models/dashboard.model';
import { LoggerService } from '../logger/logger.service';

/**
 * Thin wrapper over /api/dashboard/*.
 * The endpoints are the same ones the web dashboard consumes — no mobile-only
 * variants needed (per user's "backend frozen" rule).
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  /**
   * GET /api/dashboard/appointments?date=YYYY-MM-DD
   * Returns today's list filtered by the server (excludes NoShow/Cancelled/Rescheduled/Missed
   * per DashboardController). Caller passes a Date; we ISO-format the calendar day.
   */
  listAppointments(date: Date): Observable<AppointmentDto[]> {
    const day = toDateOnly(date);
    const params = new HttpParams().set('date', day);
    return this.http
      .get<AppointmentDto[] | { items?: AppointmentDto[]; appointments?: AppointmentDto[] }>(
        `${this.base}/api/dashboard/appointments`,
        { params },
      )
      .pipe(
        map((resp) => normalizeList(resp)),
        catchError((e) => {
          this.log.warn('Dashboard', 'listAppointments failed', e);
          return of([]);
        }),
      );
  }

  /** GET /api/dashboard/stats — returns {today, pendingOrders, noShow, missed, ...}. */
  stats(): Observable<DashboardStats> {
    return this.http
      .get<DashboardStats>(`${this.base}/api/dashboard/stats`)
      .pipe(
        catchError((e) => {
          this.log.warn('Dashboard', 'stats failed', e);
          return of<DashboardStats>({ today: 0, pendingOrders: 0, noShow: 0, missed: 0 });
        }),
      );
  }
}

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function normalizeList<T>(resp: T[] | { items?: T[]; appointments?: T[] }): T[] {
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === 'object') {
    const r = resp as { items?: T[]; appointments?: T[] };
    return r.items ?? r.appointments ?? [];
  }
  return [];
}
