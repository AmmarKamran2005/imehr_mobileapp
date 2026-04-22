/* ============================================================
   Orders & Referrals — mirrors ehr-system/Controllers/OrdersController.cs.
   ============================================================ */

export enum OrderStatus {
  Ordered = 0,
  Completed = 1,
  Cancelled = 2,
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.Ordered]:   'Ordered',
  [OrderStatus.Completed]: 'Completed',
  [OrderStatus.Cancelled]: 'Cancelled',
};

/** The server distinguishes categories at the DTO level. */
export type OrderCategory = 'Lab' | 'Imaging' | 'Referral' | 'Other';

export interface OrderDto {
  orderId?: number;
  patientId: number;
  appointmentId?: number;
  encounterId?: number;
  providerId?: number;

  category: OrderCategory;
  name: string;                   // "Basic metabolic panel"
  notes?: string;
  priority?: 'Routine' | 'Urgent' | 'STAT' | string;

  status?: OrderStatus;
  orderedAt?: string;
  completedAt?: string | null;
}
