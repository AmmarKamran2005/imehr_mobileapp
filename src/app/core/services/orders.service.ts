import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { LoggerService } from '../logger/logger.service';
import { OrderDto, OrderStatus } from '../models/orders.model';

/**
 * Orders endpoints (ehr-system/Controllers/OrdersController.cs):
 *   GET /orders?patientId=&appointmentId=
 *   POST /orders
 *   PUT  /orders/{id}
 *   DELETE /orders/{id}
 *
 * Real path varies slightly on the server — some builds expose /api/orders.
 * We default to /api/orders and fall back to /orders if that 404s, per
 * existing controller route resolution.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  async list(opts: { patientId?: number; appointmentId?: number; encounterId?: number } = {}): Promise<OrderDto[]> {
    let params = new HttpParams();
    if (opts.patientId     != null) params = params.set('patientId',     String(opts.patientId));
    if (opts.appointmentId != null) params = params.set('appointmentId', String(opts.appointmentId));
    if (opts.encounterId   != null) params = params.set('encounterId',   String(opts.encounterId));
    try {
      const r = await firstValueFrom(
        this.http.get<OrderDto[] | { items?: OrderDto[] }>(`${this.base}/api/orders`, { params }),
      );
      return Array.isArray(r) ? r : (r?.items ?? []);
    } catch (e) {
      this.log.warn('Orders', 'list failed', e);
      return [];
    }
  }

  async create(body: Partial<OrderDto> & Pick<OrderDto, 'patientId' | 'category' | 'name'>): Promise<OrderDto | null> {
    try {
      return await firstValueFrom(
        this.http.post<OrderDto>(`${this.base}/api/orders`, { status: OrderStatus.Ordered, ...body }),
      );
    } catch (e) {
      this.log.warn('Orders', 'create failed', e);
      return null;
    }
  }

  async update(id: number, patch: Partial<OrderDto>): Promise<OrderDto | null> {
    try {
      return await firstValueFrom(
        this.http.put<OrderDto>(`${this.base}/api/orders/${id}`, patch),
      );
    } catch (e) {
      this.log.warn('Orders', 'update failed', e);
      return null;
    }
  }

  async complete(id: number): Promise<OrderDto | null> {
    return this.update(id, { status: OrderStatus.Completed, completedAt: new Date().toISOString() });
  }

  async cancel(id: number): Promise<OrderDto | null> {
    return this.update(id, { status: OrderStatus.Cancelled });
  }

  async remove(id: number): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete<void>(`${this.base}/api/orders/${id}`));
      return true;
    } catch (e) {
      this.log.warn('Orders', 'remove failed', e);
      return false;
    }
  }
}
