import * as WebBrowser from "expo-web-browser";
import { pkceChallengeFromVerifier, randomUrlSafeString } from "./googlePkce";
import { writeGoogleSignInSession, clearGoogleSignInSessionAll } from "./googleAuthStorage";
import { registerGoogleOAuthPkce } from "./registerGoogleOAuthPkce";
import { getGoogleClientId, getGoogleSignInRedirectUri } from "./googleOAuthConfig";
import { completeGoogleSignInFromUrl, isGoogleAuthCallbackUrl } from "./completeGoogleSignIn";
import { logError } from "./errors";

WebBrowser.maybeCompleteAuthSession();

export { getGoogleClientId, getGoogleSignInRedirectUri } from "./googleOAuthConfig";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const LOGIN_SCOPES = ["openid", "email", "profile"];

/** Shown in Settings — same URI the web app / Google Cloud already use. */
export function getAuthRedirectUri() {
  return getGoogleSignInRedirectUri();
}

/**
 * Google sign-in using the **same** web pipeline:
 * PKCE → registerGoogleOAuthPkce → Google authorize
 * → https://musicpromoai.site/auth/google/callback
 * → googleAuthExchange → supabase.auth.signInWithIdToken
 *
 * WebBrowser.openAuthSessionAsync dismisses when the redirect URI is hit
 * and returns the callback URL to the app (no separate Expo OAuth client).
 */
export async function signInWithGoogleNative(returnTo = "/") {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      "Add EXPO_PUBLIC_GOOGLE_CLIENT_ID (same value as web VITE_GOOGLE_CLIENT_ID)."
    );
  }

  const state = randomUrlSafeString(24);
  const verifier = randomUrlSafeString(48);
  const challenge = await pkceChallengeFromVerifier(verifier);
  const redirectUri = getGoogleSignInRedirectUri();
  const safeReturn = returnTo || "/";

  await writeGoogleSignInSession({ state, verifier, returnTo: safeReturn });

  try {
    await registerGoogleOAuthPkce({ state, codeVerifier: verifier, returnTo: safeReturn });
  } catch (e) {
    logError("googleAuth.registerPkce", e);
    // Server PKCE is preferred; local verifier still sent on complete when state matches.
  }

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

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
    preferEphemeralSession: true,
  });

  if (result.type !== "success" || !("url" in result) || !result.url) {
    await clearGoogleSignInSessionAll();
    throw new Error("Google sign-in was cancelled.");
  }

  if (!isGoogleAuthCallbackUrl(result.url)) {
    await clearGoogleSignInSessionAll();
    throw new Error("Unexpected Google redirect. Expected musicpromoai.site callback.");
  }

  return completeGoogleSignInFromUrl(result.url);
}
