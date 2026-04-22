import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { LoggerService } from '../logger/logger.service';
import { ClinicalNoteDto } from '../models/clinical-note.model';
import { AppointmentDto } from '../models/appointment.model';
import { CptSelection, IcdSelection } from '../models/encounter.model';

/**
 * Finalization endpoints used by Step 7 (Checkout).
 *   POST /api/clinical-notes/{id}/sign       — sign a draft note.
 *   POST /api/appointments/{id}/checkout-with-cpt — close the encounter,
 *          generate charges + draft claim. Body carries final ICD + CPT.
 */
@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  async signNote(noteId: number, signatureData: string): Promise<ClinicalNoteDto | null> {
    try {
      return await firstValueFrom(
        this.http.post<ClinicalNoteDto>(
          `${this.base}/api/clinical-notes/${noteId}/sign`,
          { signatureData },
        ),
      );
    } catch (e) {
      this.log.warn('Checkout', `sign ${noteId} failed`, e);
      return null;
    }
  }

  async checkoutAppointment(
    appointmentId: number,
    body: {
      icdSelections: IcdSelection[];
      cptSelections: CptSelection[];
    },
  ): Promise<AppointmentDto | null> {
    try {
      return await firstValueFrom(
        this.http.post<AppointmentDto>(
          `${this.base}/api/appointments/${appointmentId}/checkout-with-cpt`,
          body,
        ),
      );
    } catch (e) {
      this.log.warn('Checkout', `checkout ${appointmentId} failed`, e);
      return null;
    }
  }
}
