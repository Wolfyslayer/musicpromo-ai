import * as Linking from 'expo-linking';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

function requireClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to sign in.');
  }
  return supabase;
}

function raise(error: { message?: string; status?: number | null } | null) {
  const err = new Error(error?.message || 'Authentication failed') as Error & { status?: number | null };
  err.status = error?.status ?? null;
  throw err;
}

export function mapUser(sessionUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null) {
  if (!sessionUser) return null;
  const meta = sessionUser.user_metadata || {};
  return {
    id: sessionUser.id,
    email: sessionUser.email || '',
    full_name: String(meta.full_name || meta.name || ''),
    role: 'artist' as const,
  };
}

export async function getCurrentUser() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) raise(error);
  if (!data?.user) {
    const err = new Error('Not signed in') as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return mapUser(data.user);
}

export async function upsertUserProfile(user: ReturnType<typeof mapUser>) {
  if (!supabase || !user?.id) return;
  const { error } = await supabase.from('users').upsert(
    {
      id: user.id,
      email: user.email || '',
      full_name: user.full_name || '',
      role: user.role || 'artist',
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[supabase] user profile', error.message);
}

export async function signInWithPassword(email: string, password: string) {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: String(email || '').trim(),
    password,
  });
  if (error) raise(error);
  const user = mapUser(data.user);
  await upsertUserProfile(user);
  return { user, session: data.session };
}

export async function signUpWithPassword(email: string, password: string) {
  const client = requireClient();
  const redirectTo = Linking.createURL('/');
  const { data, error } = await client.auth.signUp({
    email: String(email || '').trim(),
    password,
    options: { emailRedirectTo: redirectTo },
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

export async function requestPasswordReset(email: string) {
  const client = requireClient();
  const redirectTo = Linking.createURL('/reset-password');
  const { error } = await client.auth.resetPasswordForEmail(String(email || '').trim(), {
    redirectTo,
  });
  if (error) raise(error);
}

export async function updatePassword(newPassword: string) {
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) raise(error);
}

export async function verifyEmailOtp(email: string, token: string) {
  const client = requireClient();
  const { data, error } = await client.auth.verifyOtp({
    email: String(email || '').trim(),
    token: String(token || '').trim(),
    type: 'signup',
  });
  if (error) raise(error);
  const user = mapUser(data.user);
  if (user) await upsertUserProfile(user);
  return { user, session: data.session, access_token: data.session?.access_token || null };
}

export async function resendSignupOtp(email: string) {
  const client = requireClient();
  const { error } = await client.auth.resend({
    type: 'signup',
    email: String(email || '').trim(),
  });
  if (error) raise(error);
}

/** Deep-link OAuth return (Google / magic links). Call from root layout on URL events. */
export async function completeOAuthFromUrl(url: string) {
  const client = requireClient();
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const errorDescription = query.error_description;
  if (typeof errorDescription === 'string') {
    throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
  }

  const code = typeof query.code === 'string' ? query.code : null;
  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) raise(error);
    return data.session || null;
  }

  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    const hash = new URLSearchParams(url.slice(hashIndex + 1));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (accessToken && refreshToken) {
      const { data, error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) raise(error);
      return data.session || null;
    }
  }

  return null;
}
