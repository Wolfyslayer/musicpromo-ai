import { pkceChallengeFromVerifier, randomUrlSafeString } from "@/lib/googlePkce";
import { isNativeApp } from "@/lib/nativeApp";
import { writeGoogleSignInSession, clearGoogleSignInSessionAll, readGoogleSignInSession } from "@/lib/googleAuthStorage";
import { openGoogleOAuthInAppBrowser } from "@/lib/googleAuthNative";
import { getGoogleClientId, getGoogleSignInRedirectUri } from "@/lib/googleOAuthConfig";

export { GOOGLE_AUTH_STORAGE } from "@/lib/googleAuthStorage";
export { getGoogleClientId, getGoogleSignInRedirectUri } from "@/lib/googleOAuthConfig";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const LOGIN_SCOPES = ["openid", "email", "profile"];

/**
 * Start Google sign-in on your app domain (not *.supabase.co).
 * Native: in-app Chrome Custom Tab + App Link callback. Web: full redirect.
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

  writeGoogleSignInSession({ state, verifier, returnTo: returnTo || "/" });

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

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

  if (isNativeApp()) {
    await openGoogleOAuthInAppBrowser(authUrl);
    return;
  }

  window.location.assign(authUrl);
}

export function clearGoogleSignInSession() {
  clearGoogleSignInSessionAll();
}

export function readGoogleSignInReturnTo() {
  return readGoogleSignInSession().returnTo || "/";
}
