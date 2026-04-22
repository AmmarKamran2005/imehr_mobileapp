import { CurrentUser, UserRole } from './user.model';

/* ============================================================
   Request / response shapes for /api/auth/*
   Mirrors AuthController.cs on the IMEHR backend.
   Field names must match server JSON exactly.
   ============================================================ */

export interface LoginRequest {
  email: string;
  password: string;
  rememberDevice: boolean;   // web: "Remember this device for 15 days"
}

export interface LoginResponse {
  /** When true, client must send an OTP via /api/auth/verify-otp. */
  requiresOtpVerification: boolean;
  /** Populated only when OTP is NOT required (trusted device). */
  token?: string;
  refreshToken?: string;
  tokenExpiry?: string;       // ISO datetime
  user?: CurrentUser;
  /** Opaque challenge value client echoes back to /verify-otp. */
  otpChallenge?: string;
  /** Optional hint for UI (e.g. masked email). */
  message?: string;
}

export interface VerifyOtpRequest {
  email: string;
  code: string;
  otpChallenge?: string;
  rememberDevice: boolean;
}

export interface VerifyOtpResponse {
  token: string;
  refreshToken: string;
  tokenExpiry: string;
  user: CurrentUser;
}

export interface ResendOtpRequest {
  email: string;
  otpChallenge?: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
  tokenExpiry: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}

/** Local-only: what we persist in secure storage after login. */
export interface StoredAuth {
  token: string;
  refreshToken: string;
  tokenExpiry: string;
  user: CurrentUser;
}

/** Role bit used by controllers — stringified comma list (see RoleGate util). */
export type AllowedRole = UserRole | UserRole[];
