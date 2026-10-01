/**
 * TikTok Login Kit + Content Posting API helpers.
 * Official host: open.tiktokapis.com (not a Base44 social proxy).
 */

export const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_API = "https://open.tiktokapis.com";
export const TIKTOK_TOKEN_URL = `${TIKTOK_API}/v2/oauth/token/`;

/** Shared custom callback — register this exact URI in TikTok Developer Portal. */
export const SOCIAL_OAUTH_REDIRECT_URI =
  "https://flying-sonic-promo-flow.base44.app/functions/metaCustomCallback";

export const TIKTOK_CONNECT_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "video.upload",
  "video.publish",
  "video.list",
];

export function buildTikTokAuthorizeUrl(params: {
  clientKey: string;
  state: string;
  scopes?: string[];
  redirectUri?: string;
}): string {
  const q = new URLSearchParams({
    client_key: params.clientKey,
    redirect_uri: params.redirectUri || SOCIAL_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: (params.scopes || TIKTOK_CONNECT_SCOPES).join(","),
    state: params.state,
  });
  return `${TIKTOK_AUTH_URL}?${q.toString()}`;
}

export type TikTokTokenBundle = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
  token_type?: string;
};

function formatTikTokError(data: Record<string, unknown>, fallback: string): string {
  const err = data?.error as Record<string, unknown> | string | undefined;
  if (typeof err === "string" && err.trim()) return err.trim().slice(0, 300);
  if (err && typeof err === "object") {
    const msg = String(err.message || err.error_description || "").trim();
    if (msg) return msg.slice(0, 300);
  }
  const desc = String(data?.error_description || data?.message || "").trim();
  return desc ? desc.slice(0, 300) : fallback;
}

/** Exchange TikTok auth code for access + refresh tokens. */
export async function exchangeTikTokCode(params: {
  clientKey: string;
  clientSecret: string;
  code: string;
  redirectUri?: string;
}): Promise<TikTokTokenBundle> {
  const body = new URLSearchParams({
    client_key: params.clientKey,
    client_secret: params.clientSecret,
    code: String(params.code || "").replace(/#_+$/, "").trim(),
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri || SOCIAL_OAUTH_REDIRECT_URI,
  });
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`token_exchange: ${formatTikTokError(data, `HTTP ${res.status}`)}`);
  }
  return {
    access_token: String(data.access_token),
    refresh_token: data.refresh_token != null ? String(data.refresh_token) : undefined,
    expires_in: data.expires_in != null ? Number(data.expires_in) : undefined,
    refresh_expires_in:
      data.refresh_expires_in != null ? Number(data.refresh_expires_in) : undefined,
    open_id: data.open_id != null ? String(data.open_id) : undefined,
    scope: data.scope != null ? String(data.scope) : undefined,
    token_type: data.token_type != null ? String(data.token_type) : "Bearer",
  };
}

export async function refreshTikTokToken(params: {
  clientKey: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TikTokTokenBundle> {
  const body = new URLSearchParams({
    client_key: params.clientKey,
    client_secret: params.clientSecret,
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`refresh: ${formatTikTokError(data, `HTTP ${res.status}`)}`);
  }
  return {
    access_token: String(data.access_token),
    refresh_token: data.refresh_token != null ? String(data.refresh_token) : params.refreshToken,
    expires_in: data.expires_in != null ? Number(data.expires_in) : undefined,
    open_id: data.open_id != null ? String(data.open_id) : undefined,
    scope: data.scope != null ? String(data.scope) : undefined,
  };
}

export type TikTokProfile = {
  open_id: string;
  display_name?: string;
  avatar_url?: string;
  username?: string;
};

/**
 * Fetch TikTok profile. Request basic fields first (avatar + display_name),
 * then optionally username when user.info.profile was granted.
 * Requesting unauthorized fields can fail the whole /user/info call.
 */
export async function fetchTikTokProfile(accessToken: string): Promise<TikTokProfile> {
  const basicFields = "open_id,union_id,avatar_url,avatar_url_100,avatar_large_url,display_name";
  const res = await fetch(
    `${TIKTOK_API}/v2/user/info/?fields=${encodeURIComponent(basicFields)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json().catch(() => ({}));
  const user = (data?.data?.user || data?.data || {}) as Record<string, unknown>;
  const openId = user.open_id != null ? String(user.open_id) : "";
  if (!res.ok || !openId) {
    throw new Error(`profile: ${formatTikTokError(data, "Failed to load TikTok profile")}`);
  }

  const avatar =
    (user.avatar_large_url != null && String(user.avatar_large_url)) ||
    (user.avatar_url_100 != null && String(user.avatar_url_100)) ||
    (user.avatar_url != null && String(user.avatar_url)) ||
    "";

  let username = "";
  try {
    const profileFields = "open_id,username";
    const res2 = await fetch(
      `${TIKTOK_API}/v2/user/info/?fields=${encodeURIComponent(profileFields)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data2 = await res2.json().catch(() => ({}));
    const user2 = (data2?.data?.user || data2?.data || {}) as Record<string, unknown>;
    if (res2.ok && user2.username != null) username = String(user2.username);
  } catch {
    /* username needs user.info.profile — optional */
  }

  return {
    open_id: openId,
    display_name: user.display_name != null ? String(user.display_name) : undefined,
    avatar_url: avatar || undefined,
    username: username || undefined,
  };
}

/**
 * TikTok Content Posting API v2 — FILE_UPLOAD init for inbox/draft flow.
 * Caller uploads binary to upload_url, then publishes / pulls status.
 */
export async function initTikTokVideoUpload(params: {
  accessToken: string;
  videoSize: number;
  chunkSize?: number;
  totalChunkCount?: number;
}): Promise<{ publish_id: string; upload_url: string }> {
  const chunkSize = params.chunkSize || params.videoSize;
  const totalChunkCount = params.totalChunkCount || 1;
  const res = await fetch(`${TIKTOK_API}/v2/post/publish/inbox/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      source_info: {
        source: "FILE_UPLOAD",
        video_size: params.videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount,
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  const publishId = data?.data?.publish_id;
  const uploadUrl = data?.data?.upload_url;
  if (!res.ok || !publishId || !uploadUrl) {
    throw new Error(`tiktok_upload_init: ${formatTikTokError(data, `HTTP ${res.status}`)}`);
  }
  return { publish_id: String(publishId), upload_url: String(uploadUrl) };
}

export async function uploadTikTokVideoBytes(params: {
  uploadUrl: string;
  bytes: Uint8Array;
}): Promise<void> {
  const res = await fetch(params.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(params.bytes.byteLength),
      "Content-Range": `bytes 0-${params.bytes.byteLength - 1}/${params.bytes.byteLength}`,
    },
    body: params.bytes,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`tiktok_upload: HTTP ${res.status} ${text.slice(0, 180)}`);
  }
}

/** Fetch video list / insights for analytics sync. */
export async function fetchTikTokVideoList(params: {
  accessToken: string;
  videoIds?: string[];
}): Promise<
  Array<{
    id: string;
    title?: string;
    view_count?: number;
    like_count?: number;
    comment_count?: number;
    share_count?: number;
  }>
> {
  const body: Record<string, unknown> = {
    fields: ["id", "title", "view_count", "like_count", "comment_count", "share_count"],
  };
  if (params.videoIds?.length) {
    body.filters = { video_ids: params.videoIds };
  }
  const res = await fetch(`${TIKTOK_API}/v2/video/list/?fields=${encodeURIComponent((body.fields as string[]).join(","))}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.videoIds?.length ? { filters: { video_ids: params.videoIds } } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`tiktok_videos: ${formatTikTokError(data, `HTTP ${res.status}`)}`);
  }
  const list = Array.isArray(data?.data?.videos) ? data.data.videos : [];
  return list.map((v: Record<string, unknown>) => ({
    id: String(v.id || ""),
    title: v.title != null ? String(v.title) : undefined,
    view_count: v.view_count != null ? Number(v.view_count) : 0,
    like_count: v.like_count != null ? Number(v.like_count) : 0,
    comment_count: v.comment_count != null ? Number(v.comment_count) : 0,
    share_count: v.share_count != null ? Number(v.share_count) : 0,
  }));
}
