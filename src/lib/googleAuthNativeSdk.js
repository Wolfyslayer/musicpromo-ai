import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";

import { safeStoredPath } from "@/lib/completeGoogleSignIn";
import { getGoogleAndroidClientId, getGoogleClientId } from "@/lib/googleOAuthConfig";
import { clearGoogleSignInSessionAll, writeGoogleSignInSession } from "@/lib/googleAuthStorage";
import { supabase } from "@/lib/supabaseClient";
import { mapUser, upsertUserProfile } from "@/lib/supabaseAuth";

let initialized = false;

/** One-time Play Services / Google Sign-In SDK setup (Android native). */
export function initializeNativeGoogleAuth() {
  if (initialized) return;

  const serverClientId = getGoogleClientId();
  if (!serverClientId) {
    console.warn("[googleAuth] VITE_GOOGLE_CLIENT_ID missing — native Google Sign-In disabled");
    return;
  }

  const androidClientId = getGoogleAndroidClientId();
  GoogleAuth.initialize({
    clientId: serverClientId,
    scopes: ["profile", "email"],
    grantOfflineAccess: false,
    ...(androidClientId ? { androidClientId } : {}),
  });
  initialized = true;
}

function isUserCancelled(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return msg.includes("cancel") || msg.includes("12501") || msg.includes("user closed");
}

/**
 * Native account picker → Supabase session (no browser redirect).
 * @returns {{ user: object, session: object, destination: string }}
 */
export async function completeNativeGoogleSignIn(returnTo = "/") {
  if (!supabase) throw new Error("Supabase is not configured.");

  initializeNativeGoogleAuth();

  const destination = safeStoredPath(returnTo || "/");
  writeGoogleSignInSession({ returnTo: destination });

  let googleUser;
  try {
    googleUser = await GoogleAuth.signIn();
  } catch (error) {
    if (isUserCancelled(error)) throw new Error("Sign-in cancelled");
    throw error;
  }

  const idToken = googleUser?.authentication?.idToken;
  if (!idToken) {
    throw new Error(
      "Google did not return an ID token. Add an Android OAuth client (package site.musicpromoai.app + SHA-1) and set VITE_GOOGLE_CLIENT_ID to your Web client."
    );
  }

  const { data, error: signInError } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (signInError) throw signInError;

  const user = mapUser(data.user);
  if (user) await upsertUserProfile(user, data.user);

  clearGoogleSignInSessionAll();
  return { user, session: data.session, destination };
}
