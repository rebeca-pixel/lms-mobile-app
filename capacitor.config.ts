import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.knockturn.lms',
  appName: 'Knockturn LMS',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Routes fetch()/XHR through the native HTTP stack => no CORS problems when
    // calling Supabase and the existing Express API from the app.
    CapacitorHttp: { enabled: true },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#1A3DB1',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B1220',
      overlaysWebView: false
    },
    Keyboard: { resize: 'body' },
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#06B6D4',
      sound: 'default',
    },
  },
};

export default config;
