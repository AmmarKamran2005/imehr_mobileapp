import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { noAuthGuard } from './core/auth/no-auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/schedule',
    pathMatch: 'full',
  },
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
  {
    path: 'schedule',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/schedule/schedule.page').then((m) => m.SchedulePage),
  },
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
    // wildcard fallback
    path: '**',
    redirectTo: '/schedule',
  },
];
