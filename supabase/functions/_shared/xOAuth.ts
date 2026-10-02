/**
 * X (Twitter) OAuth 2.0 with PKCE — connect for profile links and future posting.
 */

import { META_OAUTH_REDIRECT_URI } from "./oauthRedirects.ts";

/** Register this exact URL in the X developer portal (can match meta-oauth-callback). */
export { META_OAUTH_REDIRECT_URI as X_OAUTH_REDIRECT_URI };

export const X_AUTHORIZE = "https://twitter.com/i/oauth2/authorize";
export const X_TOKEN = "https://api.twitter.com/2/oauth2/token";
export const X_API = "https://api.twitter.com/2";

export const X_CONNECT_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access",
] as const;

export function buildXAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: readonly string[];
  codeChallenge: string;
}): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scopes.join(" "),
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${X_AUTHORIZE}?${q}`;
}

export async function exchangeXCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
    client_id: params.clientId,
  });

  const basic = btoa(`${params.clientId}:${params.clientSecret}`);
  const res = await fetch(X_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "X token exchange failed");
  }
  return data;
}

export async function fetchXProfile(accessToken: string): Promise<{
  id: string;
  username: string;
  name: string;
  profile_image_url: string;
}> {
  const url = `${X_API}/users/me?user.fields=profile_image_url,name,username`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  const user = data?.data;
  if (!res.ok || !user?.id) {
    throw new Error(data?.detail || data?.title || "Could not load X profile");
  }
  return {
    id: String(user.id),
    username: String(user.username || ""),
    name: String(user.name || user.username || "X"),
    profile_image_url: String(user.profile_image_url || ""),
  };
}

export function xPublicProfileUrl(username: string): string {
  const u = String(username || "").trim().replace(/^@+/, "");
  return u ? `https://x.com/${u}` : "";
}

export function hasXPublishScope(scopes: string | null | undefined): boolean {
  const raw = String(scopes || "");
  return /tweet\.write/.test(raw);
}
