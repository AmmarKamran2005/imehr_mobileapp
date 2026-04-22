/**
 * /api/dashboard/stats — mirrors DashboardStatsDto server-side.
 * Some cards are hidden for nurse/MA per web CSS gates; we replicate that
 * client-side too.
 */
export interface DashboardStats {
  today: number;
  pendingOrders: number;
  noShow: number;
  missed: number;
  // Extra counters the backend may include — we don't surface them yet but
  // keep the shape open so we don't reject unknown fields.
  [key: string]: number | undefined;
}

/** Client-side stat card descriptor (for the stats row on Schedule). */
export interface StatCard {
  key: 'today' | 'pendingOrders' | 'noShow' | 'missed' | 'triage';
  icon: string;
  tone: 'primary' | 'info' | 'warning' | 'danger';
  label: string;
  value: number;
}
