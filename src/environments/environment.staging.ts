// Staging — same domain as prod for now; separate so release channels can diverge.
export const environment = {
  production: false,
  envName: 'staging',
  apiBaseUrl: 'https://ehr.medocs.ai',
  hubBaseUrl: 'https://ehr.medocs.ai',
  inactivityTimeoutMs: 15 * 60 * 1000,
  tokenRefreshThresholdMs: 5 * 60 * 1000,
  activityThrottleMs: 30 * 1000,
  otp: {
    codeLength: 6,
    expiryMs: 5 * 60 * 1000,
    resendCooldownMs: 60 * 1000,
  },
  voiceRecorder: {
    chunkMs: 15_000,
    maxSessionMs: 60 * 60 * 1000,
  },
  biometric: {
    defaultEnabled: false,
    reason: 'Confirm your identity to sign in to IMEHR',
  },
  logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error' | 'silent',
};
