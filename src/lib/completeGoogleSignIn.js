import { supabase } from "@/lib/supabaseClient";
import { getGoogleClientId, getGoogleSignInRedirectUri } from "@/lib/googleOAuthConfig";
import { clearGoogleSignInSessionAll, readGoogleSignInSession } from "@/lib/googleAuthStorage";
import { messageFromFunctionInvokeError } from "@/lib/functionInvokeError";
import { upsertUserProfile, mapUser } from "@/lib/supabaseAuth";

export function safeStoredPath(path) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
  return path;
}

function parseCallbackUrl(urlString) {
  const url = urlString.startsWith("http") ? new URL(urlString) : new URL(urlString, "https://musicpromoai.site");
  return url;
}

/**
 * Finish Google PKCE login from a callback URL (WebView route or native appUrlOpen).
 * @returns {{ destination: string }} where to navigate after success
 */
export async function completeGoogleSignInFromUrl(urlString) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const url = parseCallbackUrl(urlString);
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (oauthError) {
    throw new Error(decodeURIComponent(oauthError.replace(/\+/g, " ")));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const { state: expectedState, verifier, returnTo } = readGoogleSignInSession();

  if (!code) throw new Error("Missing authorization code from Google.");
  if (!state || !expectedState || state !== expectedState) {
    throw new Error(
      "Sign-in state mismatch. Try again from the app (do not open the callback link in an external browser)."
    );
  }
  if (!verifier) throw new Error("Missing PKCE verifier. Try again.");

  const redirectUri = getGoogleSignInRedirectUri();
  const clientId = getGoogleClientId();
  const { data: fnData, error: fnError } = await supabase.functions.invoke("googleAuthExchange", {
    body: { code, codeVerifier: verifier, redirectUri, clientId },
  });
  if (fnError) throw new Error(await messageFromFunctionInvokeError(fnError));

  const idToken = fnData?.id_token;
  if (!idToken) throw new Error(fnData?.error || "Could not exchange Google sign-in code.");

  const { data, error: signInError } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (signInError) throw signInError;

  const user = mapUser(data.user);
  if (user) await upsertUserProfile(user, data.user);

  const destination = safeStoredPath(returnTo);
  clearGoogleSignInSessionAll();
  return { destination };
}

export function isGoogleAuthCallbackUrl(urlString) {
  try {
    const path = parseCallbackUrl(urlString).pathname.replace(/\/$/, "");
    return path.endsWith("/auth/google/callback");
  } catch {
    return String(urlString).includes("/auth/google/callback");
  }
}
