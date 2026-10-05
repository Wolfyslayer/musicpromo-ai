import { isNativeApp } from "@/lib/nativeApp";

const NATIVE_APP_ORIGIN = "https://musicpromoai.site";

export function getGoogleSignInRedirectUri() {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const configured = String(import.meta.env.VITE_APP_ORIGIN || "").trim().replace(/\/$/, "");
  const origin = isNativeApp()
    ? configured || NATIVE_APP_ORIGIN
    : window.location.origin;
  return `${origin}${base}/auth/google/callback`;
}

export function getGoogleClientId() {
  return String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
}

/** Optional Android OAuth client (Play Services). Falls back to Web client in plugin config. */
export function getGoogleAndroidClientId() {
  return String(import.meta.env.VITE_GOOGLE_ANDROID_CLIENT_ID || "").trim();
}
