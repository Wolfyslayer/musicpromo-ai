import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "site.musicpromoai.app",
  appName: "MusicPromo AI",
  webDir: "dist",
  server: {
    // Bundled build: pretend to be the production site so Google OAuth redirect_uri matches
    // https://musicpromoai.site/auth/google/callback (registered in Google Cloud).
    // Without this, Android WebView origin is https://localhost → redirect_uri_mismatch.
    ...(process.env.CAP_SERVER_URL
      ? { url: process.env.CAP_SERVER_URL, cleartext: false }
      : {
          hostname: "musicpromoai.site",
          androidScheme: "https",
          iosScheme: "https",
          allowNavigation: ["accounts.google.com", "*.google.com", "musicpromoai.site"],
        }),
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
