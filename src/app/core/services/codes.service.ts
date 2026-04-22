import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { LoggerService } from '../logger/logger.service';
import {
  CptCode, CptSuggestionResponse, FavoriteCode,
  IcdCode, IcdSuggestionResponse,
} from '../models/codes.model';

/**
 * Thin wrapper over the ICD-10 / CPT search + AI-suggest + favorites endpoints.
 * Paths verified against AppointmentsController and the rules doc.
 */
@Injectable({ providedIn: 'root' })
export class CodesService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  /* ---------- Search ---------- */
  async searchIcd(query: string, take = 20): Promise<IcdCode[]> {
    if (!query?.trim()) return [];
    try {
      const params = new HttpParams().set('query', query.trim()).set('take', String(take));
      const r = await firstValueFrom(
        this.http.get<IcdCode[] | { items?: IcdCode[] }>(`${this.base}/api/icd-codes/search`, { params }),
      );
      return Array.isArray(r) ? r : (r?.items ?? []);
    } catch (e) {
      this.log.warn('Codes', 'searchIcd failed', e);
      return [];
    }
  }

  async searchCpt(query: string, take = 20): Promise<CptCode[]> {
    if (!query?.trim()) return [];
    try {
      const params = new HttpParams().set('search', query.trim()).set('take', String(take));
      const r = await firstValueFrom(
        this.http.get<CptCode[] | { items?: CptCode[] }>(`${this.base}/api/lookups/cpt-codes`, { params }),
      );
      return Array.isArray(r) ? r : (r?.items ?? []);
    } catch (e) {
      this.log.warn('Codes', 'searchCpt failed', e);
      return [];
    }
  }

  /* ---------- AI suggestions ---------- */
  async suggestIcd(appointmentId: number): Promise<IcdCode[]> {
    try {
      const r = await firstValueFrom(
        this.http.post<IcdSuggestionResponse | IcdCode[]>(
          `${this.base}/api/appointments/${appointmentId}/suggest-icd`, {},
        ),
      );
      if (Array.isArray(r)) return r;
      return r?.suggestions ?? [];
    } catch (e) {
      this.log.warn('Codes', 'suggestIcd failed', e);
      return [];
    }
  }

  async suggestCpt(appointmentId: number): Promise<CptCode[]> {
    try {
      const r = await firstValueFrom(
        this.http.post<CptSuggestionResponse | CptCode[]>(
          `${this.base}/api/appointments/${appointmentId}/suggest-cpt`, {},
        ),
      );
      if (Array.isArray(r)) return r;
      return r?.suggestions ?? [];
    } catch (e) {
      this.log.warn('Codes', 'suggestCpt failed', e);
      return [];
    }
  }

  /* ---------- Favorites ---------- */
  async favorites(type: 'ICD10' | 'CPT'): Promise<FavoriteCode[]> {
    try {
      const params = new HttpParams().set('type', type);
      const r = await firstValueFrom(
        this.http.get<FavoriteCode[] | { items?: FavoriteCode[] }>(`${this.base}/api/favorites`, { params }),
      );
      return Array.isArray(r) ? r : (r?.items ?? []);
    } catch (e) {
      this.log.warn('Codes', 'favorites failed', e);
      return [];
    }
  }

  async addFavorite(body: FavoriteCode): Promise<FavoriteCode | null> {
    try {
      return await firstValueFrom(
        this.http.post<FavoriteCode>(`${this.base}/api/favorites`, body),
      );
    } catch (e) {
      this.log.warn('Codes', 'addFavorite failed', e);
      return null;
    }
  }

  async removeFavorite(type: 'ICD10' | 'CPT', code: string): Promise<boolean> {
    try {
      const params = new HttpParams().set('type', type).set('code', code);
      await firstValueFrom(this.http.delete<void>(`${this.base}/api/favorites`, { params }));
      return true;
    } catch (e) {
      this.log.warn('Codes', 'removeFavorite failed', e);
      return false;
    }
  }
}
