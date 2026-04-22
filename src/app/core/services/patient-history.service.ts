import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { LoggerService } from '../logger/logger.service';
import {
  AllergyDto, MedicationDto, ProblemDto, FamilyHistoryDto,
  SocialHistoryDto, ImmunizationDto,
} from '../models/history.model';

/**
 * Wraps the six per-patient history endpoints the web's History Review step
 * calls. Each entity has identical CRUD semantics (GET list, POST create,
 * PUT partial, DELETE) so we generate them from a small helper.
 *
 *   /api/patients/{pid}/allergies
 *   /api/patients/{pid}/medications
 *   /api/patients/{pid}/problems
 *   /api/patients/{pid}/family-history
 *   /api/patients/{pid}/social-history
 *   /api/patients/{pid}/immunizations
 *
 * Role gate on all six: 0,1,2,6,7.
 */
@Injectable({ providedIn: 'root' })
export class PatientHistoryService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  /* ============================================================
     Allergies
     ============================================================ */
  listAllergies(pid: number)   { return this.list<AllergyDto>(pid, 'allergies'); }
  addAllergy(pid: number, body: Partial<AllergyDto>) { return this.add<AllergyDto>(pid, 'allergies', body); }
  updateAllergy(pid: number, id: number, body: Partial<AllergyDto>) { return this.update<AllergyDto>(pid, 'allergies', id, body); }
  removeAllergy(pid: number, id: number) { return this.remove(pid, 'allergies', id); }

  /* ============================================================
     Medications
     ============================================================ */
  listMedications(pid: number) { return this.list<MedicationDto>(pid, 'medications'); }
  addMedication(pid: number, body: Partial<MedicationDto>) { return this.add<MedicationDto>(pid, 'medications', body); }
  updateMedication(pid: number, id: number, body: Partial<MedicationDto>) { return this.update<MedicationDto>(pid, 'medications', id, body); }
  discontinueMedication(pid: number, id: number) {
    return this.update<MedicationDto>(pid, 'medications', id, { status: 'Discontinued', endedAt: new Date().toISOString() });
  }
  removeMedication(pid: number, id: number) { return this.remove(pid, 'medications', id); }

  /* ============================================================
     Problems
     ============================================================ */
  listProblems(pid: number)    { return this.list<ProblemDto>(pid, 'problems'); }
  addProblem(pid: number, body: Partial<ProblemDto>) { return this.add<ProblemDto>(pid, 'problems', body); }
  updateProblem(pid: number, id: number, body: Partial<ProblemDto>) { return this.update<ProblemDto>(pid, 'problems', id, body); }
  resolveProblem(pid: number, id: number) {
    return this.update<ProblemDto>(pid, 'problems', id, { status: 'Resolved', resolvedDate: new Date().toISOString() });
  }
  removeProblem(pid: number, id: number) { return this.remove(pid, 'problems', id); }

  /* ============================================================
     Family history
     ============================================================ */
  listFamilyHistory(pid: number) { return this.list<FamilyHistoryDto>(pid, 'family-history'); }
  addFamilyHistory(pid: number, body: Partial<FamilyHistoryDto>) { return this.add<FamilyHistoryDto>(pid, 'family-history', body); }
  updateFamilyHistory(pid: number, id: number, body: Partial<FamilyHistoryDto>) { return this.update<FamilyHistoryDto>(pid, 'family-history', id, body); }
  removeFamilyHistory(pid: number, id: number) { return this.remove(pid, 'family-history', id); }

  /* ============================================================
     Social history
     ============================================================ */
  listSocialHistory(pid: number) { return this.list<SocialHistoryDto>(pid, 'social-history'); }
  addSocialHistory(pid: number, body: Partial<SocialHistoryDto>) { return this.add<SocialHistoryDto>(pid, 'social-history', body); }
  updateSocialHistory(pid: number, id: number, body: Partial<SocialHistoryDto>) { return this.update<SocialHistoryDto>(pid, 'social-history', id, body); }
  removeSocialHistory(pid: number, id: number) { return this.remove(pid, 'social-history', id); }

  /* ============================================================
     Immunizations
     ============================================================ */
  listImmunizations(pid: number) { return this.list<ImmunizationDto>(pid, 'immunizations'); }
  addImmunization(pid: number, body: Partial<ImmunizationDto>) { return this.add<ImmunizationDto>(pid, 'immunizations', body); }
  updateImmunization(pid: number, id: number, body: Partial<ImmunizationDto>) { return this.update<ImmunizationDto>(pid, 'immunizations', id, body); }
  removeImmunization(pid: number, id: number) { return this.remove(pid, 'immunizations', id); }

  /* ============================================================
     Generic helpers
     ============================================================ */
  private async list<T>(patientId: number, seg: string): Promise<T[]> {
    try {
      const r = await firstValueFrom(
        this.http.get<T[] | { items?: T[] }>(
          `${this.base}/api/patients/${patientId}/${seg}`,
        ),
      );
      return Array.isArray(r) ? r : (r?.items ?? []);
    } catch (e) {
      this.log.warn('History', `list ${seg} failed`, e);
      return [];
    }
  }

  private async add<T>(patientId: number, seg: string, body: unknown): Promise<T | null> {
    try {
      return await firstValueFrom(
        this.http.post<T>(`${this.base}/api/patients/${patientId}/${seg}`, body),
      );
    } catch (e) {
      this.log.warn('History', `add ${seg} failed`, e);
      return null;
    }
  }

  private async update<T>(patientId: number, seg: string, id: number, body: unknown): Promise<T | null> {
    try {
      return await firstValueFrom(
        this.http.put<T>(`${this.base}/api/patients/${patientId}/${seg}/${id}`, body),
      );
    } catch (e) {
      this.log.warn('History', `update ${seg}/${id} failed`, e);
      return null;
    }
  }

  private async remove(patientId: number, seg: string, id: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete<void>(`${this.base}/api/patients/${patientId}/${seg}/${id}`),
      );
      return true;
    } catch (e) {
      this.log.warn('History', `remove ${seg}/${id} failed`, e);
      return false;
    }
  }
}
