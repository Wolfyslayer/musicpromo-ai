import { pkceChallengeFromVerifier, randomUrlSafeString } from "@/lib/googlePkce";

export const GOOGLE_AUTH_STORAGE = {
  state: "musicpromo:google_oauth_state",
  verifier: "musicpromo:google_oauth_verifier",
  returnTo: "musicpromo:google_oauth_return_to",
};

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const LOGIN_SCOPES = ["openid", "email", "profile"];

/** Redirect URI registered in Google Cloud (must match token exchange). */
export function getGoogleSignInRedirectUri() {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${window.location.origin}${base}/auth/google/callback`;
}

export function getGoogleClientId() {
  return String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
}

/**
 * Start Google sign-in on your app domain (not *.supabase.co).
 * Google shows "Continue to musicpromoai.site" when redirect_uri is your site.
 */
export async function startGoogleSignIn(returnTo = "/") {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      "Add VITE_GOOGLE_CLIENT_ID to your build (same OAuth client as Supabase Google provider)."
    );
  }

  const state = randomUrlSafeString(24);
  const verifier = randomUrlSafeString(48);
  const challenge = await pkceChallengeFromVerifier(verifier);
  const redirectUri = getGoogleSignInRedirectUri();

  sessionStorage.setItem(GOOGLE_AUTH_STORAGE.state, state);
  sessionStorage.setItem(GOOGLE_AUTH_STORAGE.verifier, verifier);
  sessionStorage.setItem(GOOGLE_AUTH_STORAGE.returnTo, returnTo || "/");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: LOGIN_SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });

  window.location.assign(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

export function clearGoogleSignInSession() {
  sessionStorage.removeItem(GOOGLE_AUTH_STORAGE.state);
  sessionStorage.removeItem(GOOGLE_AUTH_STORAGE.verifier);
  sessionStorage.removeItem(GOOGLE_AUTH_STORAGE.returnTo);
}

export function readGoogleSignInReturnTo() {
  return sessionStorage.getItem(GOOGLE_AUTH_STORAGE.returnTo) || "/";
}
