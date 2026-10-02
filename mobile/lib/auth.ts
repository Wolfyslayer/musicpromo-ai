import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

function requireClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to sign in.");
  }
  return supabase;
}

function raise(error: { message?: string; status?: number } | null) {
  const err = new Error(error?.message || "Authentication failed");
  (err as Error & { status?: number }).status = error?.status || undefined;
  throw err;
}

export function mapUser(sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, any> } | null | undefined): AppUser | null {
  if (!sessionUser) return null;
  const meta = sessionUser.user_metadata || {};
  return {
    id: sessionUser.id,
    email: sessionUser.email || "",
    full_name: meta.full_name || meta.name || "",
    role: "artist",
  };
}

export async function upsertUserProfile(user: AppUser | null) {
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

export async function signInWithPassword(email: string, password: string) {
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

export async function signUpWithPassword(email: string, password: string) {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({
    email: String(email || "").trim(),
    password,
    options: {
      emailRedirectTo: Linking.createURL("/"),
    },
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

export async function verifyEmailOtp(email: string, token: string) {
  const client = requireClient();
  const { data, error } = await client.auth.verifyOtp({
    email: String(email || "").trim(),
    token: String(token || "").trim(),
    type: "signup",
  });
  if (error) raise(error);
  const user = mapUser(data.user);
  if (user) await upsertUserProfile(user);
  return { user, session: data.session };
}

export async function resendSignupOtp(email: string) {
  const client = requireClient();
  const { error } = await client.auth.resend({
    type: "signup",
    email: String(email || "").trim(),
  });
  if (error) raise(error);
}

export async function requestPasswordReset(email: string) {
  const client = requireClient();
  const { error } = await client.auth.resetPasswordForEmail(String(email || "").trim(), {
    redirectTo: Linking.createURL("reset-password"),
  });
  if (error) raise(error);
}

export async function updatePassword(newPassword: string) {
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) raise(error);
}

function readParam(url: string, key: string) {
  const parsed = Linking.parse(url);
  const queryValue = parsed.queryParams?.[key];
  if (typeof queryValue === "string") return queryValue;
  const hash = url.split("#")[1] || "";
  const hashParams = new URLSearchParams(hash);
  return hashParams.get(key);
}

/** Turn an OAuth or recovery URL into a stored session. */
export async function completeAuthUrl(url: string) {
  const client = requireClient();
  const errorDescription = readParam(url, "error_description");
  if (errorDescription) {
    throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
  }
  const code = readParam(url, "code");
  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) raise(error);
    return data.session || null;
  }
  const accessToken = readParam(url, "access_token");
  const refreshToken = readParam(url, "refresh_token");
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

export async function signInWithGoogle() {
  const client = requireClient();
  const redirectTo = Linking.createURL("auth/google/callback");
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) raise(error);
  if (!data?.url) throw new Error("Google sign-in did not return a URL.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return null;
  return completeAuthUrl(result.url);
}
