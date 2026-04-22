import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { AppointmentDetailDto, AppointmentDto } from '../models/appointment.model';
import { LoggerService } from '../logger/logger.service';

/**
 * Wraps /api/appointments/* endpoints. These are the SAME endpoints the web
 * system uses — verified in ehr-system/Controllers/AppointmentsController.cs.
 *
 * Role gates (informational — server enforces):
 *   check-in:     roles 0,1,2,3,6,7
 *   start-visit:  roles 0,1,2,6,7
 *   checkout:     roles 0,1,2
 */
@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  /** GET /api/appointments/{id} — detail for the appointment detail page. */
  async get(appointmentId: number): Promise<AppointmentDetailDto | null> {
    try {
      return await firstValueFrom(
        this.http.get<AppointmentDetailDto>(`${this.base}/api/appointments/${appointmentId}`),
      );
    } catch (e) {
      this.log.warn('Appointments', `get(${appointmentId}) failed`, e);
      return null;
    }
  }

  /**
   * POST /api/appointments/{id}/checkin — moves status from Scheduled/Confirmed → CheckedIn.
   * Returns the updated appointment so the caller can refresh its view.
   */
  async checkIn(appointmentId: number): Promise<AppointmentDto | null> {
    return firstValueFrom(
      this.http.post<AppointmentDto>(
        `${this.base}/api/appointments/${appointmentId}/checkin`,
        {},
      ),
    );
  }

  /**
   * POST /api/appointments/{id}/start-visit — CheckedIn → InProgress.
   * The navigation to the encounter wizard happens in the caller; this just
   * commits the state transition and returns the updated appointment.
   */
  async startVisit(appointmentId: number): Promise<AppointmentDto | null> {
    return firstValueFrom(
      this.http.post<AppointmentDto>(
        `${this.base}/api/appointments/${appointmentId}/start-visit`,
        {},
      ),
    );
  }
}
