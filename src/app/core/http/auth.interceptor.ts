import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/verify-otp',
  '/api/auth/resend-otp',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isPublic = PUBLIC_PATHS.some((p) => req.url.includes(p));
  if (isPublic) return next(req);

  // Refresh if close to expiry, then attach Authorization header.
  return from(auth.refreshIfNeeded()).pipe(
    switchMap((ok) => {
      const token = auth.token();
      if (!ok || !token) return next(req);
      const cloned = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      return next(cloned);
    }),
  );
};
