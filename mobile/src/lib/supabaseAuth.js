import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

WebBrowser.maybeCompleteAuthSession();

function requireClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to sign in.");
  }
  return supabase;
}

function raise(error) {
  const err = new Error(error?.message || "Authentication failed");
  err.status = error?.status || null;
  throw err;
}

/** Deep link back into the app, e.g. musicpromo://reset-password. Add these to Supabase Auth redirect URLs. */
export function authRedirectUrl(path = "/") {
  return Linking.createURL(path);
}

export function mapUser(sessionUser) {
  if (!sessionUser) return null;
  const meta = sessionUser.user_metadata || {};
  return {
    id: sessionUser.id,
    email: sessionUser.email || "",
    full_name: meta.full_name || meta.name || "",
    role: "artist",
  };
}

export async function getCurrentUser() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) raise(error);
  if (!data?.user) {
    const err = new Error("Not signed in");
    err.status = 401;
    throw err;
  }
  return mapUser(data.user);
}

/** Save the auth user onto the public.users profile table. */
export async function upsertUserProfile(user) {
  if (!supabase || !user?.id) return;
  const { error } = await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email || "",
      full_name: user.full_name || "",
      role: user.role || "artist",
    },
    { onConflict: "id" }
  );
  if (error) console.warn("[supabase] user profile", error.message);
}

export async function signInWithPassword(email, password) {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: String(email || "").trim(),
    password,
  });
  if (error) raise(error);
  const user = mapUser(data.user);
  await upsertUserProfile(user);
  return { user, session: data.session };
}

export async function signUpWithPassword(email, password) {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({
    email: String(email || "").trim(),
    password,
    options: { emailRedirectTo: authRedirectUrl("/") },
  });
  if (error) raise(error);
  const user = mapUser(data.user);
  if (data.session && user) await upsertUserProfile(user);
  return { user, session: data.session || null };
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) raise(error);
}

/**
 * Turn a deep link carrying `?code=` (PKCE) or `#access_token=` into a stored session.
 * Used by OAuth returns, email confirmation and password-recovery links.
 */
export async function completeAuthFromUrl(url) {
  if (!url) return null;
  const client = requireClient();
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : "");
  const errorDescription = parsed.searchParams.get("error_description") || hash.get("error_description");
  if (errorDescription) {
    throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
  }

  const code = parsed.searchParams.get("code");
  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) raise(error);
    return data.session || null;
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) raise(error);
    return data.session || null;
  }
  return null;
}

/** Google sign-in through Supabase's Google provider in an in-app auth browser. */
export async function signInWithGoogle() {
  const client = requireClient();
  const redirectTo = authRedirectUrl("/");
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error) raise(error);
  if (!data?.url) throw new Error("Google sign-in is not available.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return null;
  const session = await completeAuthFromUrl(result.url);
  const user = mapUser(session?.user);
  if (user) await upsertUserProfile(user);
  return session;
}

export async function verifyEmailOtp(email, token) {
  const client = requireClient();
  const { data, error } = await client.auth.verifyOtp({
    email: String(email || "").trim(),
    token: String(token || "").trim(),
    type: "signup",
  });
  if (error) raise(error);
  const user = mapUser(data.user);
  if (user) await upsertUserProfile(user);
  return { user, session: data.session, access_token: data.session?.access_token || null };
}

export async function resendSignupOtp(email) {
  const client = requireClient();
  const { error } = await client.auth.resend({
    type: "signup",
    email: String(email || "").trim(),
  });
  if (error) raise(error);
}

export async function requestPasswordReset(email) {
  const client = requireClient();
  const { error } = await client.auth.resetPasswordForEmail(String(email || "").trim(), {
    redirectTo: authRedirectUrl("/reset-password"),
  });
  if (error) raise(error);
}

export async function updatePassword(newPassword) {
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) raise(error);
}
