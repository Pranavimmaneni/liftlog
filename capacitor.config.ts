import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android APK (PRD §2, M6). The web build in native mode (`npm run build:native`: relative base,
 * hash routing, no service worker) is bundled into the app, so it works offline from the first launch.
 */
const config: CapacitorConfig = {
  appId: 'app.liftlog',
  appName: 'LiftLog',
  webDir: 'dist',
  android: {
    // Matches the Paper background so there's no white flash before the splash.
    backgroundColor: '#F2EADB',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#F2EADB',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_liftlog',
      iconColor: '#9E2B25',
    },
    StatusBar: {
      overlaysWebView: false,
    },
  },
};

export default config;
