import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { applyPendingSignupHandle, authSignupUserMetadata } from "@/services/signupHandle";

function requireClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to sign in.");
  }
  return supabase;
}

function raise(error) {
  const err = new Error(error?.message || "Authentication failed");
  err.status = error?.status || null;
  throw err;
}

export function mapUser(sessionUser) {
  if (!sessionUser) return null;
  const meta = sessionUser.user_metadata || {};
  return {
    id: sessionUser.id,
    email: sessionUser.email || "",
    full_name: meta.full_name || meta.name || "",
    avatar_url: meta.avatar_url || meta.picture || "",
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
export async function upsertUserProfile(user, sessionUser) {
  if (!supabase || !user?.id) return;
  const meta = sessionUser?.user_metadata || {};
  const googleAvatar = String(meta.avatar_url || meta.picture || user.avatar_url || "").trim();

  const { data: existing } = await supabase
    .from("users")
    .select("avatar_override, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const payload = {
    id: user.id,
    email: user.email || "",
    full_name: user.full_name || "",
    role: user.role || "artist",
  };
  if (googleAvatar && !existing?.avatar_override) {
    payload.avatar_url = googleAvatar;
    payload.avatar_override = false;
  }

  const { error } = await supabase.from("users").upsert(payload, { onConflict: "id" });
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

export async function signUpWithPassword(email, password, { handle } = {}) {
  const client = requireClient();
  const meta = authSignupUserMetadata(handle);
  const { data, error } = await client.auth.signUp({
    email: String(email || "").trim(),
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: meta,
    },
  });
  if (error) raise(error);
  const user = mapUser(data.user);
  if (data.session && user) {
    await upsertUserProfile(user, data.user);
    const claim = await applyPendingSignupHandle(user.id);
    if (!claim.ok) raise(new Error(claim.error));
  }
  return { user, session: data.session || null };
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) raise(error);
}

export async function signInWithGoogle(returnTo = "/") {
  requireClient();
  const { startGoogleSignIn } = await import("@/lib/googleAuth");
  await startGoogleSignIn(returnTo);
}

/** Turn the Supabase return URL into a stored session. */
export async function completeOAuthReturn() {
  if (typeof window !== "undefined" && window.location.pathname.endsWith("/auth/google/callback")) {
    return null;
  }
  const client = requireClient();
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
  const errorDescription = url.searchParams.get("error_description") || hash.get("error_description");
  if (errorDescription) {
    throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
  }

  const code = url.searchParams.get("code");
  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) raise(error);
    url.searchParams.delete("code");
    url.searchParams.delete("sb_flow_id");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
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
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    return data.session || null;
  }

  return null;
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
  if (user) {
    await upsertUserProfile(user, data.user);
    const claim = await applyPendingSignupHandle(user.id);
    if (!claim.ok) raise(new Error(claim.error));
  }
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
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) raise(error);
}

export async function updatePassword(newPassword) {
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) raise(error);
}
