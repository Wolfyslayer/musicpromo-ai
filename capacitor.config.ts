import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "site.musicpromoai.app",
  appName: "MusicPromo AI",
  webDir: "dist",
  server: {
    // Bundled production build. For dev against live site, set CAP_SERVER_URL=https://musicpromoai.site
    ...(process.env.CAP_SERVER_URL ? { url: process.env.CAP_SERVER_URL, cleartext: false } : {}),
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      backgroundColor: "#0c0a12",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
