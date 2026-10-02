import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE_AUTH_STORAGE as STORAGE_KEYS } from '@/lib/googleAuthStorage';
import { pkceChallengeFromVerifier, randomUrlSafeString } from '@/lib/googlePkce';
import { messageFromFunctionInvokeError } from '@/lib/functionInvokeError';
import { supabase } from '@/lib/supabaseClient';
import { mapUser, upsertUserProfile } from '@/lib/supabaseAuth';

export { STORAGE_KEYS as GOOGLE_AUTH_STORAGE };

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const LOGIN_SCOPES = ['openid', 'email', 'profile'];

WebBrowser.maybeCompleteAuthSession();

export function getGoogleClientId() {
  return String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
}

export function getGoogleSignInRedirectUri() {
  return Linking.createURL('auth/google/callback');
}

function safeStoredPath(path: string) {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/';
  return path;
}

export async function clearGoogleSignInSession() {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.state),
    AsyncStorage.removeItem(STORAGE_KEYS.verifier),
    AsyncStorage.removeItem(STORAGE_KEYS.returnTo),
  ]);
}

export async function readGoogleSignInReturnTo() {
  return (await AsyncStorage.getItem(STORAGE_KEYS.returnTo)) || '/';
}

/** Complete Google OAuth from a deep link or WebBrowser result URL. */
export async function completeGoogleSignInFromUrl(url: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const oauthError =
    (typeof query.error_description === 'string' && query.error_description) ||
    (typeof query.error === 'string' && query.error);
  if (oauthError) {
    throw new Error(decodeURIComponent(String(oauthError).replace(/\+/g, ' ')));
  }

  const code = typeof query.code === 'string' ? query.code : null;
  const state = typeof query.state === 'string' ? query.state : null;
  const expectedState = await AsyncStorage.getItem(STORAGE_KEYS.state);
  const verifier = await AsyncStorage.getItem(STORAGE_KEYS.verifier);

  if (!code) throw new Error('Missing authorization code from Google.');
  if (!state || !expectedState || state !== expectedState) {
    throw new Error('Sign-in state mismatch. Try again.');
  }
  if (!verifier) throw new Error('Missing PKCE verifier. Try again.');

  const redirectUri = getGoogleSignInRedirectUri();
  const clientId = getGoogleClientId();
  const { data: fnData, error: fnError } = await supabase.functions.invoke('googleAuthExchange', {
    body: { code, codeVerifier: verifier, redirectUri, clientId },
  });
  if (fnError) throw new Error(await messageFromFunctionInvokeError(fnError));
  const idToken = (fnData as { id_token?: string })?.id_token;
  if (!idToken) {
    throw new Error((fnData as { error?: string })?.error || 'Could not exchange Google sign-in code.');
  }

  const { data, error: signInError } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (signInError) throw signInError;

  const user = mapUser(data.user);
  if (user) await upsertUserProfile(user);
  const returnTo = safeStoredPath((await AsyncStorage.getItem(STORAGE_KEYS.returnTo)) || '/');
  await clearGoogleSignInSession();
  return { user, session: data.session, returnTo };
}

/**
 * Start Google sign-in (PKCE + Edge Function exchange), same flow as the web app.
 */
export async function startGoogleSignIn(returnTo = '/') {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Add EXPO_PUBLIC_GOOGLE_CLIENT_ID (same OAuth client as Supabase Google provider).');
  }

  const state = randomUrlSafeString(24);
  const verifier = randomUrlSafeString(48);
  const challenge = await pkceChallengeFromVerifier(verifier);
  const redirectUri = getGoogleSignInRedirectUri();

  await AsyncStorage.setItem(STORAGE_KEYS.state, state);
  await AsyncStorage.setItem(STORAGE_KEYS.verifier, verifier);
  await AsyncStorage.setItem(STORAGE_KEYS.returnTo, returnTo || '/');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: LOGIN_SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'select_account',
  });

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type === 'success' && result.url) {
    return completeGoogleSignInFromUrl(result.url);
  }
  if (result.type === 'cancel' || result.type === 'dismiss') {
    await clearGoogleSignInSession();
    throw new Error('Google sign-in was cancelled.');
  }
  throw new Error('Google sign-in did not complete.');
}
