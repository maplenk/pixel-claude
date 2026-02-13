import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.claudeevents.app',
  appName: 'Claude Events',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: ['192.168.*.*', '10.*.*.*', '172.16.*.*', '*.local'],
  },
};

export default config;
