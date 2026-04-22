import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { VitalDto } from '../models/encounter.model';
import { LoggerService } from '../logger/logger.service';

/**
 * Vitals endpoints from ehr-system/Controllers/PatientVitalsController.cs.
 * Roles 0,1,2,6,7 for create / update / read.
 *
 *   GET  /api/patients/{pid}/vitals               — full history desc
 *   POST /api/patients/{pid}/vitals               — create new
 *   PUT  /api/patients/{pid}/vitals/{vitalId}     — partial update
 */
@Injectable({ providedIn: 'root' })
export class VitalsService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  async list(patientId: number): Promise<VitalDto[]> {
    try {
      const r = await firstValueFrom(
        this.http.get<VitalDto[] | { items?: VitalDto[] }>(
          `${this.base}/api/patients/${patientId}/vitals`,
        ),
      );
      if (Array.isArray(r)) return r;
      return r?.items ?? [];
    } catch (e) {
      this.log.warn('Vitals', 'list failed', e);
      return [];
    }
  }

  /**
   * Upsert — if `vital.vitalId` is set, we PUT; otherwise POST and the server
   * returns the new record (with its id). Callers should merge the response
   * back into their local state so the next save becomes a PUT.
   */
  async save(vital: VitalDto): Promise<VitalDto | null> {
    const { patientId, vitalId } = vital;
    const body = stripUndefined(vital as unknown as Record<string, unknown>);
    try {
      if (vitalId != null) {
        return await firstValueFrom(
          this.http.put<VitalDto>(
            `${this.base}/api/patients/${patientId}/vitals/${vitalId}`,
            body,
          ),
        );
      }
      return await firstValueFrom(
        this.http.post<VitalDto>(
          `${this.base}/api/patients/${patientId}/vitals`,
          body,
        ),
      );
    } catch (e) {
      this.log.warn('Vitals', 'save failed', e);
      return null;
    }
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}
