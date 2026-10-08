import { requireSupabase, authRedirectOrigin } from "./supabaseClient";

function raise(error: { message?: string; status?: number } | null) {
  const err = new Error(error?.message || "Authentication failed") as Error & { status?: number };
  err.status = error?.status || undefined;
  throw err;
}

function normalizeAppRole(raw: unknown) {
  const r = String(raw || "artist").trim().toLowerCase();
  if (r === "dev" || r === "admin") return r;
  return "artist";
}

export type AppUser = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  role: string;
};

export function mapUser(sessionUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
} | null): AppUser | null {
  if (!sessionUser) return null;
  const meta = sessionUser.user_metadata || {};
  const appMeta = sessionUser.app_metadata || {};
  return {
    id: sessionUser.id,
    email: sessionUser.email || "",
    full_name: String(meta.full_name || meta.name || ""),
    avatar_url: String(meta.avatar_url || meta.picture || ""),
    role: normalizeAppRole(appMeta.role),
  };
}

export async function getCurrentUser() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) raise(error);
  if (!data?.user) {
    const err = new Error("Not signed in") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return mapUser(data.user)!;
}

export async function upsertUserProfile(user: AppUser, sessionUser?: { user_metadata?: Record<string, unknown> }) {
  const client = requireSupabase();
  if (!user?.id) return;
  const meta = sessionUser?.user_metadata || {};
  const googleAvatar = String(meta.avatar_url || meta.picture || user.avatar_url || "").trim();

  const { data: existing } = await client
    .from("users")
    .select("avatar_override, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    id: user.id,
    email: user.email || "",
    full_name: user.full_name || "",
  };
  if (!existing) payload.role = user.role || "artist";
  if (googleAvatar && !(existing as { avatar_override?: boolean } | null)?.avatar_override) {
    payload.avatar_url = googleAvatar;
    payload.avatar_override = false;
  }

  const { error } = await client.from("users").upsert(payload, { onConflict: "id" });
  if (error) console.warn("[supabase] user profile", error.message);
}

export async function signInWithPassword(email: string, password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: String(email || "").trim(),
    password,
  });
  if (error) raise(error);
  const user = mapUser(data.user)!;
  await upsertUserProfile(user);
  return { user, session: data.session };
}

export async function signUpWithPassword(email: string, password: string, handle?: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: String(email || "").trim(),
    password,
    options: {
      emailRedirectTo: `${authRedirectOrigin}`,
      data: handle ? { handle: String(handle).trim() } : undefined,
    },
  });
  if (error) raise(error);
  const user = mapUser(data.user);
  if (user) await upsertUserProfile(user, data.user || undefined);
  return { user, session: data.session };
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) raise(error);
}

export async function requestPasswordReset(email: string) {
  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(String(email || "").trim(), {
    redirectTo: `${authRedirectOrigin}reset-password`,
  });
  if (error) raise(error);
}

export async function updatePassword(newPassword: string) {
  const client = requireSupabase();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) raise(error);
}

export async function verifyEmailOtp(email: string, otpCode: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.verifyOtp({
    email: String(email || "").trim(),
    token: String(otpCode || "").trim(),
    type: "signup",
  });
  if (error) raise(error);
  return { user: mapUser(data.user), session: data.session };
}

export async function resendSignupOtp(email: string) {
  const client = requireSupabase();
  const { error } = await client.auth.resend({
    type: "signup",
    email: String(email || "").trim(),
  });
  if (error) raise(error);
}
