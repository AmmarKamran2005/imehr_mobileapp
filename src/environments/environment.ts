// Local development — talks to IMEHR dev server on HTTP port 5002.
// Replaced at build time by environment.prod.ts for production builds.
export const environment = {
  production: false,
  envName: 'local',
  apiBaseUrl: 'http://localhost:5002',
  hubBaseUrl: 'http://localhost:5002',
  inactivityTimeoutMs: 15 * 60 * 1000,        // HIPAA: 15-min idle auto-logout
  tokenRefreshThresholdMs: 5 * 60 * 1000,     // refresh when <5 min left
  activityThrottleMs: 30 * 1000,              // emit activity event max every 30s
  otp: {
    codeLength: 6,
    expiryMs: 5 * 60 * 1000,
    resendCooldownMs: 60 * 1000,
  },
  voiceRecorder: {
    chunkMs: 15_000,                          // 15s chunks (web uses variable)
    maxSessionMs: 60 * 60 * 1000,             // 1 hour safety cap
  },
  biometric: {
    defaultEnabled: false,
    reason: 'Confirm your identity to sign in to IMEHR',
  },
  logLevel: 'debug' as 'debug' | 'info' | 'warn' | 'error' | 'silent',
};
