import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AuthSession from "expo-auth-session";
import { Platform } from "react-native";
import { requireSupabase } from "./supabaseClient";
import { mapUser, upsertUserProfile } from "./supabaseAuth";
import { logError } from "./errors";

WebBrowser.maybeCompleteAuthSession();

export function getGoogleClientId() {
  return String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
}

/** Deep-link redirect for Supabase OAuth (must be allow-listed in Supabase Auth URLs). */
export function getAuthRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: "musicpromoai",
    path: "auth/callback",
  });
}

function extractParams(url: string) {
  const parsed = Linking.parse(url);
  const query = (parsed.queryParams || {}) as Record<string, string | undefined>;
  let hashParams: Record<string, string> = {};
  const hashIndex = url.indexOf("#");
  if (hashIndex >= 0) {
    hashParams = Object.fromEntries(new URLSearchParams(url.slice(hashIndex + 1)));
  }
  return { ...hashParams, ...query };
}

/**
 * Google sign-in for Expo.
 * 1) Prefer id_token via Google OAuth (EXPO_PUBLIC_GOOGLE_CLIENT_ID) → supabase.signInWithIdToken
 * 2) Else Supabase signInWithOAuth + auth session (add musicpromoai://auth/callback to Supabase redirect URLs)
 */
export async function signInWithGoogleNative() {
  const client = requireSupabase();
  const googleClientId = getGoogleClientId();

  if (googleClientId) {
    return signInWithGoogleIdToken(googleClientId);
  }

  // Fallback: Supabase-hosted Google OAuth
  const redirectTo = getAuthRedirectUri();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Google sign-in did not return an auth URL.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !("url" in result) || !result.url) {
    throw new Error("Google sign-in was cancelled.");
  }

  const params = extractParams(result.url);
  if (params.error_description || params.error) {
    throw new Error(
      decodeURIComponent(String(params.error_description || params.error).replace(/\+/g, " "))
    );
  }

  if (params.code) {
    const { data: sessionData, error: exchangeError } = await client.auth.exchangeCodeForSession(
      String(params.code)
    );
    if (exchangeError) throw exchangeError;
    const user = mapUser(sessionData.user);
    if (user && sessionData.user) await upsertUserProfile(user, sessionData.user);
    return { user, session: sessionData.session };
  }

  if (params.access_token && params.refresh_token) {
    const { data: sessionData, error: setError } = await client.auth.setSession({
      access_token: String(params.access_token),
      refresh_token: String(params.refresh_token),
    });
    if (setError) throw setError;
    const user = mapUser(sessionData.user);
    if (user && sessionData.user) await upsertUserProfile(user, sessionData.user);
    return { user, session: sessionData.session };
  }

  throw new Error("Google sign-in finished without a session. Check Supabase redirect URLs.");
}

async function signInWithGoogleIdToken(clientId: string) {
  const client = requireSupabase();
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "musicpromoai",
    path: "auth/google",
  });

  // Web client ID works for Expo Go / web; add iOS/Android clients in Google Cloud for store builds.
  const discovery = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  };

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ["openid", "profile", "email"],
    responseType: AuthSession.ResponseType.IdToken,
    usePKCE: false,
    extraParams: {
      nonce: Math.random().toString(36).slice(2),
      prompt: "select_account",
    },
  });

  await request.makeAuthUrlAsync(discovery);

  const result = await request.promptAsync(discovery, { preferEphemeralSession: true });
  if (result.type !== "success") {
    throw new Error("Google sign-in was cancelled.");
  }

  const idToken =
    result.params?.id_token ||
    (result as { authentication?: { idToken?: string } }).authentication?.idToken;
  if (!idToken) {
    logError("google.idToken", result);
    throw new Error(
      "Google did not return an ID token. Confirm EXPO_PUBLIC_GOOGLE_CLIENT_ID matches the Supabase Google provider client."
    );
  }

  const { data, error } = await client.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;

  const user = mapUser(data.user);
  if (user) await upsertUserProfile(user, data.user || undefined);

  if (Platform.OS === "web") {
    // no-op; session already set
  }

  return { user, session: data.session };
}
