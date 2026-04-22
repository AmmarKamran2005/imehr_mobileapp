import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.medocs.imehr.mobile',
  appName: 'IMEHR',
  webDir: 'www',
  server: {
    // Dev: uncomment and set to your machine's LAN IP when live-reloading on device
    // url: 'http://192.168.1.42:8100',
    cleartext: false,   // prod uses HTTPS; flip to true only for local HTTP dev
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0b63ce',
    allowMixedContent: false,
    // Required so the Android OS doesn't strip the view when recording in background.
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0b63ce',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0b63ce',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',   // dark content on light background; ThemeService re-syncs at runtime
      overlay: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    BiometricAuth: {
      allowDeviceCredential: false,
    },
  },
};

export default config;
