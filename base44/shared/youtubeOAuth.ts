/**
 * YouTube / Google OAuth + Data API v3 helpers for Shorts upload & analytics.
 * Official hosts: accounts.google.com, oauth2.googleapis.com, www.googleapis.com.
 */

import { YOUTUBE_OAUTH_REDIRECT_URI } from "./oauthRedirects.ts";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const YT_API = "https://www.googleapis.com/youtube/v3";
export const YT_UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";

/** Register this exact URI on the Google Cloud OAuth client (legacy direct Edge callback). */
export { YOUTUBE_OAUTH_REDIRECT_URI };
export const SOCIAL_OAUTH_REDIRECT_URI = YOUTUBE_OAUTH_REDIRECT_URI;

/** OAuth redirect on your app domain so Google shows musicpromoai.site (not *.supabase.co). */
export function youTubeAppRedirectUri(publicAppUrl: string): string {
  const base = String(publicAppUrl || "").trim().replace(/\/$/, "");
  if (!base) return YOUTUBE_OAUTH_REDIRECT_URI;
  return `${base}/auth/youtube/callback`;
}

/** Client ID from the SPA (`VITE_GOOGLE_CLIENT_ID`) on connectSocialProvider invoke. */
export function readGoogleClientIdFromInvokeBody(
  body: Record<string, unknown> | undefined | null
): string {
  if (!body) return "";
  const nested = [body, body.args, body.data, body.payload, body.params].filter(
    (x): x is Record<string, unknown> => Boolean(x && typeof x === "object")
  );
  for (const obj of nested) {
    for (const key of ["googleClientId", "clientId"]) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "";
}

export const YOUTUBE_CONNECT_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "openid",
  "profile",
];

export function buildYouTubeAuthorizeUrl(params: {
  clientId: string;
  state: string;
  scopes?: string[];
  redirectUri?: string;
  forceConsent?: boolean;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri || SOCIAL_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: (params.scopes || YOUTUBE_CONNECT_SCOPES).join(" "),
    state: params.state,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: params.forceConsent === false ? "select_account" : "consent",
  });
  return `${GOOGLE_AUTH_URL}?${q.toString()}`;
}

export type GoogleTokenBundle = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

function formatGoogleError(data: Record<string, unknown>, fallback: string): string {
  const err = data?.error;
  if (err && typeof err === "object" && !Array.isArray(err)) {
    const o = err as Record<string, unknown>;
    const msg = String(o.message || o.error_description || "").trim();
    if (msg) return msg.slice(0, 300);
    const nested = Array.isArray(o.errors) ? (o.errors[0] as Record<string, unknown>) : null;
    const reason = nested ? String(nested.reason || nested.message || "").trim() : "";
    const code = o.code != null ? String(o.code) : "";
    const combined = [code && `HTTP ${code}`, reason].filter(Boolean).join(": ");
    if (combined) return combined.slice(0, 300);
  }
  const desc = String(data?.error_description || "").trim();
  if (desc) return desc.slice(0, 300);
  if (typeof err === "string" && err.trim()) return err.trim().slice(0, 300);
  return fallback;
}

export async function exchangeYouTubeCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri?: string;
}): Promise<GoogleTokenBundle> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: String(params.code || "").replace(/#_+$/, "").trim(),
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri || SOCIAL_OAUTH_REDIRECT_URI,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`token_exchange: ${formatGoogleError(data, `HTTP ${res.status}`)}`);
  }
  return {
    access_token: String(data.access_token),
    refresh_token: data.refresh_token != null ? String(data.refresh_token) : undefined,
    expires_in: data.expires_in != null ? Number(data.expires_in) : undefined,
    scope: data.scope != null ? String(data.scope) : undefined,
    token_type: data.token_type != null ? String(data.token_type) : "Bearer",
    id_token: data.id_token != null ? String(data.id_token) : undefined,
  };
}

export async function refreshYouTubeToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<GoogleTokenBundle> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`refresh: ${formatGoogleError(data, `HTTP ${res.status}`)}`);
  }
  return {
    access_token: String(data.access_token),
    refresh_token: params.refreshToken,
    expires_in: data.expires_in != null ? Number(data.expires_in) : undefined,
    scope: data.scope != null ? String(data.scope) : undefined,
    token_type: data.token_type != null ? String(data.token_type) : "Bearer",
  };
}

export type YouTubeChannelProfile = {
  channel_id: string;
  title?: string;
  custom_url?: string;
  thumbnail_url?: string;
};

export async function fetchYouTubeChannel(accessToken: string): Promise<YouTubeChannelProfile> {
  const q = new URLSearchParams({
    part: "snippet",
    mine: "true",
  });
  const res = await fetch(`${YT_API}/channels?${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  const item = Array.isArray(data?.items) ? data.items[0] : null;
  if (!res.ok || !item?.id) {
    throw new Error(
      `profile: ${formatGoogleError(data, "Failed to load YouTube channel (ensure channel exists)")}`
    );
  }
  const sn = item.snippet || {};
  return {
    channel_id: String(item.id),
    title: sn.title != null ? String(sn.title) : undefined,
    custom_url: sn.customUrl != null ? String(sn.customUrl) : undefined,
    thumbnail_url: sn.thumbnails?.default?.url
      ? String(sn.thumbnails.default.url)
      : sn.thumbnails?.medium?.url
        ? String(sn.thumbnails.medium.url)
        : undefined,
  };
}

/** Ensure Shorts-friendly title ends with #Shorts. */
export function ensureShortsTitle(title: string): string {
  const base = String(title || "Promo Short").trim().slice(0, 90);
  if (/#shorts\b/i.test(base)) return base;
  const withTag = `${base} #Shorts`;
  return withTag.slice(0, 100);
}

/**
 * Resumable upload of a Short (MP4) to YouTube Data API v3.
 */
export async function uploadYouTubeShort(params: {
  accessToken: string;
  videoBytes: Uint8Array;
  title: string;
  description?: string;
  privacyStatus?: "public" | "unlisted" | "private";
}): Promise<{ videoId: string }> {
  const title = ensureShortsTitle(params.title);
  const description = String(params.description || "").slice(0, 5000);
  const meta = {
    snippet: {
      title,
      description,
      categoryId: "10",
    },
    status: {
      privacyStatus: params.privacyStatus || "public",
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch(
    `${YT_UPLOAD}?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(params.videoBytes.byteLength),
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify(meta),
    }
  );
  const uploadUrl = initRes.headers.get("location") || initRes.headers.get("Location");
  if (!initRes.ok || !uploadUrl) {
    const data = await initRes.json().catch(() => ({}));
    throw new Error(`youtube_upload_init: ${formatGoogleError(data, `HTTP ${initRes.status}`)}`);
  }

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "video/mp4",
      "Content-Length": String(params.videoBytes.byteLength),
    },
    body: params.videoBytes,
  });
  const putData = await putRes.json().catch(() => ({}));
  if (!putRes.ok || !putData.id) {
    throw new Error(`youtube_upload: ${formatGoogleError(putData, `HTTP ${putRes.status}`)}`);
  }
  return { videoId: String(putData.id) };
}

export async function fetchYouTubeVideoStats(params: {
  accessToken: string;
  videoIds: string[];
}): Promise<
  Array<{
    id: string;
    title?: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
  }>
> {
  const ids = params.videoIds.filter(Boolean).slice(0, 50);
  if (!ids.length) return [];
  const q = new URLSearchParams({
    part: "statistics,snippet",
    id: ids.join(","),
  });
  const res = await fetch(`${YT_API}/videos?${q}`, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`youtube_stats: ${formatGoogleError(data, `HTTP ${res.status}`)}`);
  }
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((it: Record<string, unknown>) => {
    const stats = (it.statistics || {}) as Record<string, string>;
    const sn = (it.snippet || {}) as Record<string, string>;
    return {
      id: String(it.id || ""),
      title: sn.title,
      viewCount: Number(stats.viewCount || 0),
      likeCount: Number(stats.likeCount || 0),
      commentCount: Number(stats.commentCount || 0),
    };
  });
}
