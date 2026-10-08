/**
 * TikTok Login Kit + Content Posting API helpers.
 * Official host: open.tiktokapis.com (not a Base44 social proxy).
 */

import { TIKTOK_OAUTH_REDIRECT_URI } from "./oauthRedirects.ts";
import { secrets } from "./runtime.ts";

export const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_API = "https://open.tiktokapis.com";
export const TIKTOK_TOKEN_URL = `${TIKTOK_API}/v2/oauth/token/`;

/** Register this exact URI in the TikTok Developer Portal. */
export { TIKTOK_OAUTH_REDIRECT_URI };
export const SOCIAL_OAUTH_REDIRECT_URI = TIKTOK_OAUTH_REDIRECT_URI;

export const TIKTOK_CONNECT_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "video.upload",
  "video.publish",
  "video.list",
];

export function hasTikTokPublishScope(scopes: unknown): boolean {
  const raw = String(scopes || "").toLowerCase();
  return raw.includes("video.publish");
}

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

export type TikTokCreatorInfo = {
  privacy_level_options: string[];
  max_video_post_duration_sec?: number;
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
};

/** Required before direct post — pick a valid privacy_level for post_info. */
export async function queryTikTokCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
  const res = await fetch(`${TIKTOK_API}/v2/post/publish/creator_info/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`tiktok_creator_info: ${formatTikTokError(data, `HTTP ${res.status}`)}`);
  }
  const info = (data?.data || {}) as Record<string, unknown>;
  const options = Array.isArray(info.privacy_level_options)
    ? info.privacy_level_options.map((o) => String(o))
    : [];
  return {
    privacy_level_options: options,
    max_video_post_duration_sec:
      info.max_video_post_duration_sec != null
        ? Number(info.max_video_post_duration_sec)
        : undefined,
    comment_disabled: info.comment_disabled === true,
    duet_disabled: info.duet_disabled === true,
    stitch_disabled: info.stitch_disabled === true,
  };
}

/**
 * Direct Post privacy. Default favors PUBLIC so video.list + stats sync work.
 * Set Supabase secret TIKTOK_DEFAULT_PUBLISH_PRIVACY=SELF_ONLY to keep "Only me" posts.
 */
export function pickTikTokPrivacyLevel(options: string[]): string {
  if (!options.length) return "SELF_ONLY";
  const pref = String(secrets.get("TIKTOK_DEFAULT_PUBLISH_PRIVACY") || "")
    .trim()
    .toUpperCase();
  if (pref === "SELF_ONLY" && options.includes("SELF_ONLY")) return "SELF_ONLY";
  if (pref && options.includes(pref)) return pref;
  const publicFirst = [
    "PUBLIC_TO_EVERYONE",
    "MUTUAL_FOLLOW_FRIENDS",
    "FOLLOWER_OF_CREATOR",
    "SELF_ONLY",
  ];
  for (const p of publicFirst) {
    if (options.includes(p)) return p;
  }
  return options[0] || "SELF_ONLY";
}

/**
 * Direct post (profile) — NOT inbox/draft. Requires video.publish scope + Direct Post enabled in TikTok app.
 */
export async function initTikTokDirectVideoPost(params: {
  accessToken: string;
  videoSize: number;
  title: string;
  privacyLevel?: string;
  brandContentToggle?: boolean;
  brandOrganicToggle?: boolean;
  isAigc?: boolean;
  videoDurationSec?: number;
  chunkSize?: number;
  totalChunkCount?: number;
}): Promise<{ publish_id: string; upload_url: string; privacy_level: string }> {
  const creator = await queryTikTokCreatorInfo(params.accessToken);
  let privacyLevel: string;
  if (params.privacyLevel === "SELF_ONLY") {
    if (!creator.privacy_level_options.includes("SELF_ONLY")) {
      throw new Error(
        "tiktok_only_me_unavailable: TikTok did not offer “Only me” for this account. In the TikTok app, turn on Private account (Settings and privacy → Privacy), disconnect and reconnect TikTok in Social Hub, then retry."
      );
    }
    privacyLevel = "SELF_ONLY";
  } else {
    privacyLevel = pickTikTokPrivacyLevel(creator.privacy_level_options);
  }

  if (
    creator.max_video_post_duration_sec &&
    params.videoDurationSec != null &&
    params.videoDurationSec > creator.max_video_post_duration_sec
  ) {
    throw new Error(
      `Video is ${Math.round(params.videoDurationSec)}s but this TikTok account allows up to ${creator.max_video_post_duration_sec}s.`
    );
  }

  const chunkSize = params.chunkSize || params.videoSize;
  const totalChunkCount = params.totalChunkCount || 1;
  const title = String(params.title || "").trim().slice(0, 2200) || "Promo";

  const res = await fetch(`${TIKTOK_API}/v2/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title,
        privacy_level: privacyLevel,
        disable_duet: creator.duet_disabled === true,
        disable_comment: creator.comment_disabled === true,
        disable_stitch: creator.stitch_disabled === true,
        video_cover_timestamp_ms: 1000,
        brand_content_toggle: params.brandContentToggle === true,
        brand_organic_toggle: params.brandOrganicToggle === true,
        is_aigc: params.isAigc === true,
      },
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
    throw new Error(`tiktok_direct_init: ${formatTikTokError(data, `HTTP ${res.status}`)}`);
  }
  return {
    publish_id: String(publishId),
    upload_url: String(uploadUrl),
    privacy_level: privacyLevel,
  };
}

export type TikTokPublishStatus = {
  status: string;
  fail_reason?: string;
  publicPostIds?: string[];
};

export async function fetchTikTokPublishStatus(
  accessToken: string,
  publishId: string
): Promise<TikTokPublishStatus> {
  const res = await fetch(`${TIKTOK_API}/v2/post/publish/status/fetch/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`tiktok_publish_status: ${formatTikTokError(data, `HTTP ${res.status}`)}`);
  }
  const row = (data?.data || {}) as Record<string, unknown>;
  const collected: string[] = [];
  const pushIds = (raw: unknown) => {
    if (Array.isArray(raw)) {
      for (const id of raw) {
        const s = String(id || "").trim();
        if (s) collected.push(s);
      }
    } else if (raw != null && String(raw).trim()) {
      collected.push(String(raw).trim());
    }
  };
  pushIds(row.publicaly_available_post_id);
  pushIds(row.publicly_available_post_id);
  pushIds(row.video_id);
  pushIds(row.post_id);
  return {
    status: String(row.status || ""),
    fail_reason: row.fail_reason != null ? String(row.fail_reason) : undefined,
    publicPostIds: collected.length ? [...new Set(collected)] : undefined,
  };
}

export async function waitForTikTokDirectPost(params: {
  accessToken: string;
  publishId: string;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<TikTokPublishStatus> {
  const maxAttempts = params.maxAttempts ?? 45;
  const delayMs = params.delayMs ?? 4000;
  for (let i = 0; i < maxAttempts; i++) {
    const st = await fetchTikTokPublishStatus(params.accessToken, params.publishId);
    const status = st.status.toUpperCase();
    if (status === "PUBLISH_COMPLETE") {
      return st;
    }
    if (status === "SEND_TO_USER_INBOX") {
      throw new Error(
        "TikTok returned inbox/draft flow. Reconnect TikTok with video.publish and enable Direct Post in the TikTok developer app."
      );
    }
    if (status === "FAILED") {
      throw new Error(st.fail_reason || "TikTok direct post failed.");
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("TikTok direct post timed out while processing.");
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

export function looksLikeTikTokPublishId(id: string): boolean {
  const s = String(id || "").trim();
  return Boolean(s && (s.includes("~") || /^v_pub/i.test(s)));
}

/** Resolve TikTok Content Posting publish_id to a public video id when possible. */
export async function resolveTikTokVideoIdForStats(
  accessToken: string,
  externalPostId: string
): Promise<string> {
  const raw = String(externalPostId || "").trim();
  if (!raw || !looksLikeTikTokPublishId(raw)) return raw;
  const publishId = raw.replace(/\|uploaded$/i, "").trim();
  const pending = new Set([
    "PROCESSING",
    "PROCESSING_UPLOAD",
    "PROCESSING_DOWNLOAD",
    "SEND_TO_USER_INBOX",
  ]);
  for (let attempt = 0; attempt < 8; attempt++) {
    const st = await fetchTikTokPublishStatus(accessToken, publishId).catch(() => null);
    const vid = st?.publicPostIds?.find((id) => id && !looksLikeTikTokPublishId(id));
    if (vid) return String(vid);
    const status = String(st?.status || "").toUpperCase();
    if (status === "FAILED") break;
    const waitingForPublicId = status === "PUBLISH_COMPLETE" && !(st?.publicPostIds?.length);
    if (!pending.has(status) && !waitingForPublicId) break;
    if (attempt < 7) {
      await new Promise((r) => setTimeout(r, waitingForPublicId ? 5000 : 1500));
    }
  }
  return raw;
}

/** When publish_id never resolves, pair recent list videos to posts (newest first). */
export function matchTikTokPostsToRecentVideos(
  posts: Record<string, unknown>[],
  recentVideos: Array<{ id: string }>,
  mediaIdForPost: (post: Record<string, unknown>) => string
): Map<string, string> {
  const out = new Map<string, string>();
  const needs = posts.filter((p) => looksLikeTikTokPublishId(mediaIdForPost(p)));
  if (!needs.length) return out;
  const pool = recentVideos
    .map((v) => String(v.id || "").trim())
    .filter((id) => id && !looksLikeTikTokPublishId(id));
  const sorted = [...needs].sort(
    (a, b) =>
      Date.parse(String(b.published_at || b.updated_at || 0)) -
      Date.parse(String(a.published_at || a.updated_at || 0))
  );
  for (let i = 0; i < sorted.length && i < pool.length; i++) {
    out.set(String(sorted[i].id), pool[i]);
  }
  return out;
}

const TIKTOK_VIDEO_METRIC_FIELDS =
  "id,title,view_count,like_count,comment_count,share_count,create_time";

function assertTikTokEnvelopeOk(data: Record<string, unknown>, label: string): void {
  const err = data?.error;
  const code =
    typeof err === "object" && err && !Array.isArray(err)
      ? String((err as Record<string, unknown>).code || "")
      : String(err || "");
  if (code && code.toLowerCase() !== "ok") {
    throw new Error(`${label}: ${formatTikTokError(data, code)}`);
  }
}

function mapTikTokVideoRows(list: Record<string, unknown>[]) {
  return list.map((v) => ({
    id: String(v.id || ""),
    title: v.title != null ? String(v.title) : undefined,
    view_count: v.view_count != null ? Number(v.view_count) : 0,
    like_count: v.like_count != null ? Number(v.like_count) : 0,
    comment_count: v.comment_count != null ? Number(v.comment_count) : 0,
    share_count: v.share_count != null ? Number(v.share_count) : 0,
  }));
}

/** Query specific video ids (Display API). */
export async function fetchTikTokVideosByQuery(params: {
  accessToken: string;
  videoIds: string[];
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
  const ids = params.videoIds
    .map((id) => String(id || "").trim())
    .filter((id) => id && !looksLikeTikTokPublishId(id));
  if (!ids.length) return [];
  const res = await fetch(
    `${TIKTOK_API}/v2/video/query/?fields=${encodeURIComponent(TIKTOK_VIDEO_METRIC_FIELDS)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filters: { video_ids: ids.slice(0, 20) } }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`tiktok_video_query: ${formatTikTokError(data, `HTTP ${res.status}`)}`);
  }
  assertTikTokEnvelopeOk(data as Record<string, unknown>, "tiktok_video_query");
  const list = Array.isArray(data?.data?.videos) ? data.data.videos : [];
  return mapTikTokVideoRows(list as Record<string, unknown>[]);
}

/** Fetch video list / insights for analytics sync (public videos on the account). */
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
  const filteredIds = (params.videoIds || [])
    .map((id) => String(id || "").trim())
    .filter((id) => id && !looksLikeTikTokPublishId(id));
  if (filteredIds.length) {
    return fetchTikTokVideosByQuery({ accessToken: params.accessToken, videoIds: filteredIds });
  }
  const res = await fetch(
    `${TIKTOK_API}/v2/video/list/?fields=${encodeURIComponent(TIKTOK_VIDEO_METRIC_FIELDS)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_count: 20 }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`tiktok_videos: ${formatTikTokError(data, `HTTP ${res.status}`)}`);
  }
  assertTikTokEnvelopeOk(data as Record<string, unknown>, "tiktok_videos");
  const list = Array.isArray(data?.data?.videos) ? data.data.videos : [];
  return mapTikTokVideoRows(list as Record<string, unknown>[]);
}
