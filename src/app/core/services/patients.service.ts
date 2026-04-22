import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { LoggerService } from '../logger/logger.service';

/** Mirrors PatientListDto on the server. */
export interface PatientListItem {
  patientId: number;
  mrn?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth?: string;
  age?: number;
  phone?: string;
  email?: string;
  status?: number;               // 0 Active · 1 Inactive · 2 Discharged · 3 Deceased
  primaryInsurance?: string;
  lastVisit?: string | null;
  isArchived?: boolean;
  hasProfilePicture?: boolean;
}

/** Mirrors PatientDetailDto. Additional address, emergency contact, insurance rows. */
export interface PatientDetailDto extends PatientListItem {
  gender?: string;
  ssn?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;

  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  emergencyContactAltPhone?: string;

  insurances?: Array<{
    insuranceId?: number;
    type?: 'Primary' | 'Secondary' | string;
    payerName?: string;
    payerId?: string;
    memberId?: string;
    groupNumber?: string;
    planName?: string;
    copay?: number;
    deductible?: number;
    effectiveDate?: string;
    subscriberName?: string;
    subscriberRelationship?: string;
    status?: 'Active' | 'Inactive' | string;
  }>;
}

export interface PagedPatients {
  items: PatientListItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class PatientsService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  async listPaged(opts: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: number;
  } = {}): Promise<PagedPatients> {
    let params = new HttpParams()
      .set('page',     String(opts.page     ?? 1))
      .set('pageSize', String(opts.pageSize ?? 25));
    if (opts.search) params = params.set('search', opts.search);
    if (opts.status != null) params = params.set('statuses', String(opts.status));

    try {
      const r = await firstValueFrom(
        this.http.get<PagedPatients>(`${this.base}/api/patients/paged`, { params }),
      );
      return r ?? { items: [], totalCount: 0, totalPages: 0, page: 1, pageSize: opts.pageSize ?? 25 };
    } catch (e) {
      this.log.warn('Patients', 'listPaged failed', e);
      return { items: [], totalCount: 0, totalPages: 0, page: 1, pageSize: opts.pageSize ?? 25 };
    }
  }

  async get(patientId: number): Promise<PatientDetailDto | null> {
    try {
      return await firstValueFrom(
        this.http.get<PatientDetailDto>(`${this.base}/api/patients/${patientId}`),
      );
    } catch (e) {
      this.log.warn('Patients', `get(${patientId}) failed`, e);
      return null;
    }
  }
}

export function patientInitials(p: PatientListItem | PatientDetailDto | null): string {
  if (!p) return '?';
  const name = (p.fullName ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`).trim();
  if (!name) return '?';
  const parts = name.split(/\s+/).slice(0, 2);
  return parts.map((s) => s[0]?.toUpperCase() ?? '').join('') || '?';
}

export function patientStatusLabel(s?: number): { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' } {
  switch (s) {
    case 0:  return { label: 'Active',     tone: 'success' };
    case 1:  return { label: 'Inactive',   tone: 'warning' };
    case 2:  return { label: 'Discharged', tone: 'neutral' };
    case 3:  return { label: 'Deceased',   tone: 'danger' };
    default: return { label: 'Unknown',    tone: 'neutral' };
  }
}
