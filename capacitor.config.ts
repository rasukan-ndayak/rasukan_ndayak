import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.rasukanndayak.admin',
  appName: 'Rasukan Ndayak',
  webDir: 'dist',
  server: {
    url: 'https://rasukan-ndayak.vercel.app',
    cleartext: false
  }
};

export default config;
