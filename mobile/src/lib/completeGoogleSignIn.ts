import { requireSupabase } from "./supabaseClient";
import { getGoogleClientId, getGoogleSignInRedirectUri } from "./googleOAuthConfig";
import { clearGoogleSignInSessionAll, readGoogleSignInSession } from "./googleAuthStorage";
import { messageFromFunctionInvokeError } from "./functionInvokeError";
import { mapUser, upsertUserProfile } from "./supabaseAuth";

export function safeStoredPath(path?: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
  return path;
}

function parseCallbackUrl(urlString: string) {
  return urlString.startsWith("http")
    ? new URL(urlString)
    : new URL(urlString, "https://musicpromoai.site");
}

export function isGoogleAuthCallbackUrl(urlString: string) {
  try {
    const path = parseCallbackUrl(urlString).pathname.replace(/\/$/, "");
    return path.endsWith("/auth/google/callback");
  } catch {
    return String(urlString).includes("/auth/google/callback");
  }
}

/**
 * Finish Google PKCE login — identical contract to web
 * `completeGoogleSignInFromUrl` → Edge Function `googleAuthExchange` → signInWithIdToken.
 */
export async function completeGoogleSignInFromUrl(urlString: string) {
  const supabase = requireSupabase();

  const url = parseCallbackUrl(urlString);
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (oauthError) {
    throw new Error(decodeURIComponent(oauthError.replace(/\+/g, " ")));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const session = await readGoogleSignInSession();

  if (!code) throw new Error("Missing authorization code from Google.");
  if (!state) throw new Error("Missing OAuth state. Try again.");

  const redirectUri = getGoogleSignInRedirectUri();
  const clientId = getGoogleClientId();
  const body: Record<string, string> = {
    code,
    state,
    redirectUri,
    clientId,
  };
  if (session.verifier && session.state === state) {
    body.codeVerifier = session.verifier;
  }

  const { data: fnData, error: fnError } = await supabase.functions.invoke("googleAuthExchange", {
    body,
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
  if (user) await upsertUserProfile(user, data.user || undefined);

  const destination = safeStoredPath(fnData?.return_to || session.returnTo);
  await clearGoogleSignInSessionAll();
  return { destination, user, session: data.session };
}
