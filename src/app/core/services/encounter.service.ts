import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { EncounterDto } from '../models/encounter.model';
import { LoggerService } from '../logger/logger.service';

/**
 * Wraps /api/patients/{pid}/encounters/* — the encounter is the long-lived
 * record a visit attaches to. Most clinical data (CC/HPI, ICD/CPT selections,
 * note references) lives on the encounter.
 *
 * Roles:
 *   create (POST):      0,1,2
 *   update (PUT):       0,1,2,6,7
 *   get/list (GET):     0,1,2,6,7
 */
@Injectable({ providedIn: 'root' })
export class EncounterService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  async create(patientId: number, body: Partial<EncounterDto>): Promise<EncounterDto | null> {
    try {
      return await firstValueFrom(
        this.http.post<EncounterDto>(
          `${this.base}/api/patients/${patientId}/encounters`,
          body,
        ),
      );
    } catch (e) {
      this.log.warn('Encounter', 'create failed', e);
      return null;
    }
  }

  /** Partial update — send only the fields you're changing. */
  async update(patientId: number, encounterId: number, patch: Partial<EncounterDto>): Promise<EncounterDto | null> {
    try {
      return await firstValueFrom(
        this.http.put<EncounterDto>(
          `${this.base}/api/patients/${patientId}/encounters/${encounterId}`,
          patch,
        ),
      );
    } catch (e) {
      this.log.warn('Encounter', 'update failed', e);
      return null;
    }
  }

  async get(patientId: number, encounterId: number): Promise<EncounterDto | null> {
    try {
      return await firstValueFrom(
        this.http.get<EncounterDto>(
          `${this.base}/api/patients/${patientId}/encounters/${encounterId}`,
        ),
      );
    } catch (e) {
      this.log.warn('Encounter', 'get failed', e);
      return null;
    }
  }

  async listForPatient(patientId: number): Promise<EncounterDto[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<EncounterDto[] | { items?: EncounterDto[] }>(
          `${this.base}/api/patients/${patientId}/encounters`,
        ),
      );
      if (Array.isArray(res)) return res;
      return res?.items ?? [];
    } catch (e) {
      this.log.warn('Encounter', 'list failed', e);
      return [];
    }
  }
}
