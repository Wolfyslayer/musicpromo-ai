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

const X_UPLOAD = "https://upload.twitter.com/1.1/media/upload.json";
const X_TWEET_MAX = 280;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function refreshXToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
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
    throw new Error(data?.error_description || data?.error || "X token refresh failed");
  }
  return data;
}

async function uploadXMediaSimple(params: {
  accessToken: string;
  bytes: Uint8Array;
  mimeType: string;
}): Promise<string> {
  const form = new URLSearchParams();
  form.set("media_data", bytesToBase64(params.bytes));
  if (params.mimeType.startsWith("video/")) {
    form.set("media_category", "tweet_video");
  } else {
    form.set("media_category", "tweet_image");
  }
  const res = await fetch(X_UPLOAD, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.media_id_string) {
    throw new Error(data?.error || data?.errors?.[0]?.message || "X media upload failed");
  }
  return String(data.media_id_string);
}

async function uploadXMediaChunked(params: {
  accessToken: string;
  bytes: Uint8Array;
  mimeType: string;
}): Promise<string> {
  const total = params.bytes.byteLength;
  const initBody = new URLSearchParams({
    command: "INIT",
    total_bytes: String(total),
    media_type: params.mimeType || "video/mp4",
    media_category: "tweet_video",
  });
  const initRes = await fetch(X_UPLOAD, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: initBody,
  });
  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok || !initData?.media_id_string) {
    throw new Error(initData?.error || "X video upload init failed");
  }
  const mediaId = String(initData.media_id_string);
  const segmentSize = 4 * 1024 * 1024;
  let segmentIndex = 0;
  for (let offset = 0; offset < total; offset += segmentSize) {
    const chunk = params.bytes.subarray(offset, Math.min(offset + segmentSize, total));
    const appendBody = new URLSearchParams({
      command: "APPEND",
      media_id: mediaId,
      segment_index: String(segmentIndex),
      media_data: bytesToBase64(chunk),
    });
    const appendRes = await fetch(X_UPLOAD, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: appendBody,
    });
    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}));
      throw new Error(err?.error || "X video upload append failed");
    }
    segmentIndex += 1;
  }
  const finBody = new URLSearchParams({ command: "FINALIZE", media_id: mediaId });
  const finRes = await fetch(X_UPLOAD, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: finBody,
  });
  const finData = await finRes.json().catch(() => ({}));
  if (!finRes.ok) {
    throw new Error(finData?.error || "X video upload finalize failed");
  }
  for (let i = 0; i < 30; i++) {
    const processing = finData?.processing_info;
    if (!processing || processing.state === "succeeded") break;
    if (processing.state === "failed") {
      throw new Error(processing.error?.message || "X video processing failed");
    }
    const waitMs = (processing.check_after_secs || 2) * 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    const statusBody = new URLSearchParams({ command: "STATUS", media_id: mediaId });
    const statusRes = await fetch(X_UPLOAD, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: statusBody,
    });
    const statusData = await statusRes.json().catch(() => ({}));
    if (statusData?.processing_info?.state === "succeeded") break;
    if (statusData?.processing_info?.state === "failed") {
      throw new Error(statusData?.processing_info?.error?.message || "X video processing failed");
    }
  }
  return mediaId;
}

export async function uploadXMedia(params: {
  accessToken: string;
  bytes: Uint8Array;
  mimeType: string;
}): Promise<string> {
  const mime = params.mimeType || "application/octet-stream";
  if (mime.startsWith("video/") && params.bytes.byteLength > 5 * 1024 * 1024) {
    return uploadXMediaChunked(params);
  }
  return uploadXMediaSimple(params);
}

export function truncateXTweetText(text: string): string {
  const t = String(text || "").trim();
  if (t.length <= X_TWEET_MAX) return t;
  return `${t.slice(0, X_TWEET_MAX - 1)}…`;
}

export async function createXTweet(params: {
  accessToken: string;
  text: string;
  mediaId?: string;
}): Promise<{ tweetId: string; permalink: string }> {
  const text = truncateXTweetText(params.text);
  if (!text && !params.mediaId) {
    throw new Error("X posts require caption text or media.");
  }
  const body: Record<string, unknown> = { text: text || " " };
  if (params.mediaId) {
    body.media = { media_ids: [params.mediaId] };
  }
  const res = await fetch(`${X_API}/tweets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  const tweetId = data?.data?.id;
  if (!res.ok || !tweetId) {
    throw new Error(data?.detail || data?.title || data?.errors?.[0]?.message || "X post failed");
  }
  return {
    tweetId: String(tweetId),
    permalink: `https://x.com/i/web/status/${tweetId}`,
  };
}

export function guessMediaMime(url: string, mediaType: string): string {
  const mt = String(mediaType || "").toUpperCase();
  if (mt === "REELS" || mt === "VIDEO") return "video/mp4";
  const lower = String(url || "").toLowerCase();
  if (/\.(mp4|mov|webm)(\?|$)/.test(lower)) return "video/mp4";
  if (/\.png(\?|$)/.test(lower)) return "image/png";
  if (/\.(jpe?g)(\?|$)/.test(lower)) return "image/jpeg";
  return "image/jpeg";
}
