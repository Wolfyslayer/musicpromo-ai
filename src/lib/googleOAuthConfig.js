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
