import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { noAuthGuard } from './core/auth/no-auth.guard';

/**
 * Routing layout
 * ---
 *   /login, /otp, /biometric-prompt        — auth screens, no tab bar
 *   /tabs                                  — bottom tab shell
 *     /tabs/home                           — dashboard (today + 7-day strip)
 *     /tabs/schedule                       — browse any date's schedule
 *     /tabs/patients                       — patient list
 *     /tabs/more                           — settings / profile
 *   /appointment/:id                       — full-screen, above tabs
 *   /encounter/:appointmentId              — full-screen wizard
 *   /patient/:id                           — full-screen chart with tabs inside
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full',
  },

  /* ---------- Auth ---------- */
  {
    path: 'login',
    canActivate: [noAuthGuard],
    loadComponent: () =>
      import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'otp',
    canActivate: [noAuthGuard],
    loadComponent: () =>
      import('./features/auth/otp/otp.page').then((m) => m.OtpPage),
  },
  {
    path: 'biometric-prompt',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/biometric-prompt/biometric-prompt.page').then(
        (m) => m.BiometricPromptPage,
      ),
  },

  /* ---------- Tab shell + child pages ---------- */
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () =>
          import('./features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'schedule',
        loadComponent: () =>
          import('./features/schedule/schedule.page').then((m) => m.SchedulePage),
      },
      {
        path: 'patients',
        loadComponent: () =>
          import('./features/patients/patients-list.page').then((m) => m.PatientsListPage),
      },
      {
        path: 'more',
        loadComponent: () =>
          import('./features/more/more.page').then((m) => m.MorePage),
      },
    ],
  },

  /* ---------- Full-screen pages (push above tabs) ---------- */
  {
    path: 'appointment/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointment-detail/appointment-detail.page').then(
        (m) => m.AppointmentDetailPage,
      ),
  },
  {
    path: 'encounter/:appointmentId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/encounter/encounter.page').then((m) => m.EncounterPage),
  },
  {
    path: 'patient/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/patients/patient-detail.page').then((m) => m.PatientDetailPage),
  },

  /* ---------- Back-compat redirects ----------
     Old callers hit /schedule or /tabs/schedule expecting "today's
     dashboard". That's the Home tab now. Route /home likewise. */
  { path: 'schedule', redirectTo: '/tabs/home' },
  { path: 'home',     redirectTo: '/tabs/home' },
  { path: 'patients', redirectTo: '/tabs/patients' },
  { path: 'more',     redirectTo: '/tabs/more' },

  /* wildcard */
  { path: '**', redirectTo: '/tabs/home' },
];
