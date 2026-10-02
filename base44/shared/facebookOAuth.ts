/**
 * Facebook Login → Page access for community links and future Page publishing.
 * Uses a dedicated Meta app: FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET (not Instagram META_*).
 */

import { META_OAUTH_REDIRECT_URI } from "./oauthRedirects.ts";

export const FB_GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Minimal scopes so connect works in Meta **Development** mode without App Review.
 * Publishing may require reconnect after `pages_manage_posts` is approved in the Meta app.
 */
export const FACEBOOK_CONNECT_SCOPES = ["pages_show_list", "pages_read_engagement"] as const;

/** Optional — request on reconnect when App Review has approved Page publishing. */
export const FACEBOOK_PUBLISH_SCOPES = ["pages_manage_posts"] as const;

export { META_OAUTH_REDIRECT_URI as FACEBOOK_OAUTH_REDIRECT_URI };

export type FacebookPage = {
  id: string;
  name: string;
  username?: string;
  access_token: string;
  picture_url?: string;
};

export function buildFacebookAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: readonly string[];
  forceReauth?: boolean;
  /** When true, ask for Page publishing scopes (App Review required in Live mode). */
  includePublishScopes?: boolean;
}): string {
  const scopeList = [...params.scopes];
  if (params.includePublishScopes) {
    for (const s of FACEBOOK_PUBLISH_SCOPES) {
      if (!scopeList.includes(s)) scopeList.push(s);
    }
  }
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
    scope: scopeList.join(","),
    response_type: "code",
    return_scopes: "true",
  });
  if (params.forceReauth) q.set("auth_type", "rerequest");
  return `https://www.facebook.com/v21.0/dialog/oauth?${q}`;
}

export async function exchangeFacebookCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ access_token: string; token_type?: string; expires_in?: number }> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
  });
  const res = await fetch(`${FB_GRAPH}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    const msg = data?.error?.message || data?.error || "Facebook token exchange failed";
    throw new Error(String(msg));
  }
  return data;
}

export async function exchangeFacebookLongLived(params: {
  clientId: string;
  clientSecret: string;
  shortLivedToken: string;
}): Promise<{ access_token: string; expires_in?: number }> {
  const url = `${FB_GRAPH}/oauth/access_token?${new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    fb_exchange_token: params.shortLivedToken,
  })}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error?.message || "Facebook long-lived token exchange failed");
  }
  return data;
}

export async function fetchFacebookPages(userAccessToken: string): Promise<FacebookPage[]> {
  const url = `${FB_GRAPH}/me/accounts?${new URLSearchParams({
    fields: "id,name,username,access_token,picture{url}",
    access_token: userAccessToken,
  })}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || "Could not list Facebook Pages");
  }
  const rows = Array.isArray(data?.data) ? data.data : [];
  return rows
    .map((row: Record<string, unknown>) => {
      const picture = row.picture as { data?: { url?: string } } | undefined;
      return {
        id: String(row.id || ""),
        name: String(row.name || "Facebook Page"),
        username: row.username ? String(row.username) : "",
        access_token: String(row.access_token || ""),
        picture_url: picture?.data?.url ? String(picture.data.url) : "",
      };
    })
    .filter((p) => p.id && p.access_token);
}

export function facebookPagePublicUrl(page: FacebookPage): string {
  if (page.username) return `https://www.facebook.com/${page.username}`;
  return `https://www.facebook.com/${page.id}`;
}

export function hasFacebookPublishScope(scopes: string | null | undefined): boolean {
  const parts = String(scopes || "")
    .split(/[,\s]+/)
    .filter(Boolean);
  return parts.includes("pages_manage_posts");
}
