import { CurrentUser, UserRole } from './user.model';

/* ============================================================
   Request / response shapes for /api/auth/*
   Mirrors AuthController.cs + UserLoginDto / VerifyOtpDto / UserLoginResponseDto.
   Responses are normalized to camelCase by the casing.interceptor before
   they reach this layer.
   ============================================================ */

export interface LoginRequest {
  email: string;
  password: string;
  /** Optional tenant selector for multi-tenant users; usually null. */
  tenantId?: number | null;
}

/**
 * Flat response from the backend. Note there is NO nested `user` object —
 * identity + tenant + flags live side-by-side with the tokens.
 */
export interface LoginResponse {
  /** "" when OTP is still required; populated on trusted devices. */
  token: string;
  refreshToken?: string;
  tokenExpiry?: string;

  userId: number;
  email: string;
  fullName: string;
  role: UserRole;
  tenantId?: number | null;
  tenantName?: string | null;
  tenantSubdomain?: string | null;
  tenantHasLogo?: boolean;
  providerId?: number | null;

  requiresTenantSelection?: boolean;
  requiresOtpVerification?: boolean;
  maskedEmail?: string;
  pendingDeviceTrust?: boolean;

  message?: string;
}

export interface VerifyOtpRequest {
  email: string;
  /** Server field is exactly `otpCode`. */
  otpCode: string;
  tenantId?: number | null;
  /** Set the 15-day trusted-device cookie on success. */
  rememberDevice: boolean;
}

/** Same envelope as LoginResponse — once verified, token is populated. */
export type VerifyOtpResponse = LoginResponse;

export interface ResendOtpRequest {
  email: string;
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

/** Helper: flatten the API payload down to our local CurrentUser. */
export function toCurrentUser(r: LoginResponse): CurrentUser {
  return {
    userId:     r.userId,
    email:      r.email,
    fullName:   r.fullName,
    role:       r.role,
    tenantId:   r.tenantId ?? 0,
    tenantName: r.tenantName ?? '',
    providerId: r.providerId ?? null,
  };
}

/** Role bit used by controllers — stringified comma list (see RoleGate util). */
export type AllowedRole = UserRole | UserRole[];
