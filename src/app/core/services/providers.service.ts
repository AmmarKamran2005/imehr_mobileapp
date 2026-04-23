import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { LoggerService } from '../logger/logger.service';

/** Minimal shape the mobile Schedule filter needs. Server-side field
 *  names are richer (ProviderDetailDto) but we only consume these here. */
export interface ProviderListItem {
  providerId: number;
  userId?: number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  specialty?: string;
  color?: string;
  isActive?: boolean;
  hasProfilePicture?: boolean;
}

/**
 * Wraps GET /api/providers — used by the Schedule filter dropdown.
 * Therapists don't see this filter on the web (role-gated UI); mobile
 * does the same check at the component level.
 */
@Injectable({ providedIn: 'root' })
export class ProvidersService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  async list(opts: { activeOnly?: boolean } = {}): Promise<ProviderListItem[]> {
    let params = new HttpParams();
    if (opts.activeOnly) params = params.set('activeOnly', 'true');
    try {
      const r = await firstValueFrom(
        this.http.get<ProviderListItem[] | { items?: ProviderListItem[] }>(
          `${this.base}/api/providers`,
          { params },
        ),
      );
      return Array.isArray(r) ? r : (r?.items ?? []);
    } catch (e) {
      this.log.warn('Providers', 'list failed', e);
      return [];
    }
  }
}
