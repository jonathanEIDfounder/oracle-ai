import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oracleai.app',
  appName: 'Oracle AI',
  webDir: 'public',
  server: {
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0a0a1a',
    preferredContentMode: 'mobile',
    scrollEnabled: true
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0a0a1a'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a1a',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0a0a1a'
    }
  }
};

export default config;
