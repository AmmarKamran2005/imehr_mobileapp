import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ClinicalNoteDto, NoteType } from '../models/clinical-note.model';
import { LoggerService } from '../logger/logger.service';

/**
 * Wraps /api/clinical-notes/* on the IMEHR backend.
 * Source: ehr-system/Controllers/ClinicalNotesController.cs.
 *
 * Role gate (server-enforced):
 *   create (POST)  : 0,1,2
 *   update (PUT)   : 0,1,2
 *   sign   (POST)  : 0,1,2  — handled in Phase 7 checkout
 *   read   (GET)   : 0,1,2,6,7
 *
 * Nurse / MA cannot create or mutate clinical notes. The UI hides those
 * affordances and the server would reject them anyway.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalNotesService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  /** Notes attached to an appointment. Returns newest first per server convention. */
  async byAppointment(appointmentId: number): Promise<ClinicalNoteDto[]> {
    try {
      const r = await firstValueFrom(
        this.http.get<ClinicalNoteDto[] | { items?: ClinicalNoteDto[] }>(
          `${this.base}/api/clinical-notes/by-appointment/${appointmentId}`,
        ),
      );
      return Array.isArray(r) ? r : (r?.items ?? []);
    } catch (e) {
      this.log.warn('Notes', 'byAppointment failed', e);
      return [];
    }
  }

  /** All notes for a patient — supports ?status=&providerId= on the server. */
  async list(patientId: number, opts?: { providerId?: number; status?: number }): Promise<ClinicalNoteDto[]> {
    try {
      let params = new HttpParams().set('patientId', String(patientId));
      if (opts?.providerId != null) params = params.set('providerId', String(opts.providerId));
      if (opts?.status    != null) params = params.set('status',    String(opts.status));
      const r = await firstValueFrom(
        this.http.get<ClinicalNoteDto[] | { items?: ClinicalNoteDto[] }>(
          `${this.base}/api/clinical-notes`,
          { params },
        ),
      );
      return Array.isArray(r) ? r : (r?.items ?? []);
    } catch (e) {
      this.log.warn('Notes', 'list failed', e);
      return [];
    }
  }

  async get(noteId: number): Promise<ClinicalNoteDto | null> {
    try {
      return await firstValueFrom(
        this.http.get<ClinicalNoteDto>(`${this.base}/api/clinical-notes/${noteId}`),
      );
    } catch (e) {
      this.log.warn('Notes', `get ${noteId} failed`, e);
      return null;
    }
  }

  async create(body: Partial<ClinicalNoteDto> & { patientId: number; type: NoteType }): Promise<ClinicalNoteDto | null> {
    try {
      return await firstValueFrom(
        this.http.post<ClinicalNoteDto>(`${this.base}/api/clinical-notes`, body),
      );
    } catch (e) {
      this.log.warn('Notes', 'create failed', e);
      return null;
    }
  }

  async update(noteId: number, patch: Partial<ClinicalNoteDto>): Promise<ClinicalNoteDto | null> {
    try {
      return await firstValueFrom(
        this.http.put<ClinicalNoteDto>(`${this.base}/api/clinical-notes/${noteId}`, patch),
      );
    } catch (e) {
      this.log.warn('Notes', `update ${noteId} failed`, e);
      return null;
    }
  }
}
