import { getPublicAppOrigin } from "./appOrigin";

/** Same Web OAuth client as web `VITE_GOOGLE_CLIENT_ID`. */
export function getGoogleClientId() {
  return String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
}

/**
 * Exact redirect registered in Google Cloud for the web login client:
 * `https://musicpromoai.site/auth/google/callback`
 */
export function getGoogleSignInRedirectUri() {
  return `${getPublicAppOrigin()}/auth/google/callback`;
}
