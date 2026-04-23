/**
 * /api/dashboard/stats — mirrors DashboardStatsDto on the server exactly.
 * PascalCase keys are converted to camelCase by casing.interceptor, so the
 * keys below are the shape mobile code sees.
 */
export interface DashboardStats {
  todayAppointments: number;
  completedToday: number;
  pendingNotes: number;
  todayCollections: number;
  activePatients: number;
  totalPatients: number;
  outstandingAr: number;
  authorizationsExpiringSoon: number;
  noShowsToday: number;
  claimsPending: number;
}

/**
 * /api/dashboard/appointments — mirrors DashboardAppointmentsDto. Returns
 * today's queue (server-side timezone aware) plus aggregate counters.
 */
export interface DashboardAppointmentsResponse {
  appointments: import('./appointment.model').AppointmentDto[];
  waitingForCheckInCount: number;
  missingNotesCount: number;
  requiresSignatureCount: number;
  totalCount: number;
}

/** Client-side stat card descriptor for the stats row on Schedule. */
export interface StatCard {
  key: 'today' | 'completed' | 'pendingNotes' | 'noShow' | 'triage' | 'pendingOrders';
  icon: string;
  tone: 'primary' | 'info' | 'warning' | 'danger' | 'success';
  label: string;
  value: number;
}
