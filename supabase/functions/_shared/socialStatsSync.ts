/**
 * Cross-platform social stats sync → AnalyticsEntry rows.
 * Instagram Graph insights, YouTube Data API statistics, TikTok video list metrics.
 */

import { decryptCredential } from "./socialCrypto.ts";
import { IG_GRAPH, IG_API_VERSION } from "./instagramPublishing.ts";
import { refreshTikTokToken, fetchTikTokVideoList } from "./tiktokOAuth.ts";
import { refreshYouTubeToken, fetchYouTubeVideoStats } from "./youtubeOAuth.ts";
import { secrets } from "./runtime.ts";

export type SyncStatsResult = {
  provider: string;
  socialAccountId: string;
  upserted: number;
  skipped: number;
  errors: string[];
};

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function decryptAccountCreds(
  encrypted: string,
  encryptionKey: string
): Promise<Record<string, unknown>> {
  const raw = await decryptCredential(encrypted, encryptionKey);
  return JSON.parse(raw);
}

async function upsertAnalytics(params: {
  // deno-lint-ignore no-explicit-any
  base44: any;
  campaignId: string;
  platform: string;
  contentType: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
  socialPostId?: string;
  externalPostId?: string;
  userId?: string;
}): Promise<"created" | "updated"> {
  const date = todayDate();
  const existing = await params.base44.asServiceRole.entities.AnalyticsEntry.filter(
    {
      campaign_id: params.campaignId,
      platform: params.platform,
      date,
      content_type: params.contentType,
    },
    "-created_date",
    5
  ).catch(() => []);

  const match = (existing || []).find((row: Record<string, unknown>) => {
    if (params.externalPostId && row.external_post_id) {
      return String(row.external_post_id) === String(params.externalPostId);
    }
    if (params.socialPostId && row.social_post_id) {
      return String(row.social_post_id) === String(params.socialPostId);
    }
    return !row.external_post_id && !row.social_post_id;
  });

  const fields = {
    campaign_id: params.campaignId,
    platform: params.platform,
    content_type: params.contentType,
    date,
    views: params.views || 0,
    likes: params.likes || 0,
    comments: params.comments || 0,
    shares: params.shares || 0,
    saves: params.saves || 0,
    is_demo: false,
    social_post_id: params.socialPostId || "",
    external_post_id: params.externalPostId || "",
    source: "synced",
    ...(params.userId ? { user_id: params.userId } : {}),
  };

  if (match?.id) {
    await params.base44.asServiceRole.entities.AnalyticsEntry.update(match.id, fields);
    return "updated";
  }
  await params.base44.asServiceRole.entities.AnalyticsEntry.create(fields);
  return "created";
}

async function fetchInstagramMediaInsights(params: {
  accessToken: string;
  mediaId: string;
}): Promise<{ views: number; likes: number; comments: number; saves: number; shares: number }> {
  const metrics = "views,plays,likes,comments,saved,shares";
  const q = new URLSearchParams({
    metric: metrics,
    access_token: params.accessToken,
  });
  const res = await fetch(
    `${IG_GRAPH}/${IG_API_VERSION}/${encodeURIComponent(params.mediaId)}/insights?${q}`
  );
  const data = await res.json().catch(() => ({}));
  const out = { views: 0, likes: 0, comments: 0, saves: 0, shares: 0 };
  if (!res.ok) {
    // Fall back to media fields when insights unavailable (image posts / scope).
    const q2 = new URLSearchParams({
      fields: "like_count,comments_count",
      access_token: params.accessToken,
    });
    const res2 = await fetch(
      `${IG_GRAPH}/${IG_API_VERSION}/${encodeURIComponent(params.mediaId)}?${q2}`
    );
    const d2 = await res2.json().catch(() => ({}));
    if (res2.ok) {
      out.likes = Number(d2.like_count || 0);
      out.comments = Number(d2.comments_count || 0);
    } else {
      throw new Error(String(data?.error?.message || `insights HTTP ${res.status}`));
    }
    return out;
  }
  const rows = Array.isArray(data?.data) ? data.data : [];
  for (const row of rows) {
    const name = String(row.name || "");
    const value = Number(row.values?.[0]?.value ?? row.value ?? 0);
    if (name === "views" || name === "plays") out.views = Math.max(out.views, value);
    if (name === "likes") out.likes = value;
    if (name === "comments") out.comments = value;
    if (name === "saved") out.saves = value;
    if (name === "shares") out.shares = value;
  }
  return out;
}

/**
 * Sync stats for one SocialAccount into AnalyticsEntry rows (linked via published SocialPosts).
 */
export async function syncSocialStats(params: {
  // deno-lint-ignore no-explicit-any
  base44: any;
  socialAccountId: string;
  encryptionKey?: string;
}): Promise<SyncStatsResult> {
  const encryptionKey =
    params.encryptionKey || secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY") || "";
  if (!encryptionKey) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured");
  }

  const account = await params.base44.asServiceRole.entities.SocialAccount.get(
    params.socialAccountId
  );
  if (!account) throw new Error("SocialAccount not found");
  if (account.status !== "connected" || !account.encrypted_credentials) {
    throw new Error("SocialAccount is not connected");
  }

  const provider = String(account.provider || "");
  const result: SyncStatsResult = {
    provider,
    socialAccountId: String(account.id),
    upserted: 0,
    skipped: 0,
    errors: [],
  };

  const posts = await params.base44.asServiceRole.entities.SocialPost.filter(
    {
      user_id: account.user_id,
      provider,
      status: "published",
    },
    "-published_at",
    50
  ).catch(() => []);

  const withMedia = (posts || []).filter(
    (p: Record<string, unknown>) => p.external_post_id && p.campaign_id
  );
  if (!withMedia.length) {
    result.skipped = 1;
    return result;
  }

  let creds = await decryptAccountCreds(String(account.encrypted_credentials), encryptionKey);

  if (provider === "instagram") {
    const accessToken = String(creds.access_token || creds.page_access_token || "");
    for (const post of withMedia) {
      try {
        const stats = await fetchInstagramMediaInsights({
          accessToken,
          mediaId: String(post.external_post_id),
        });
        await upsertAnalytics({
          base44: params.base44,
          campaignId: String(post.campaign_id),
          platform: "Instagram",
          contentType: String(post.media_type || "REELS").toLowerCase() === "image" ? "Feed" : "Reel",
          views: stats.views,
          likes: stats.likes,
          comments: stats.comments,
          shares: stats.shares,
          saves: stats.saves,
          socialPostId: String(post.id),
          externalPostId: String(post.external_post_id),
          userId: String(account.user_id || post.user_id || ""),
        });
        result.upserted += 1;
      } catch (err) {
        result.errors.push(`ig:${post.external_post_id}:${(err as Error)?.message || err}`);
      }
    }
    return result;
  }

  if (provider === "youtube") {
    let accessToken = String(creds.access_token || "");
    if (creds.refresh_token) {
      try {
        const clientId = secrets.get("GOOGLE_CLIENT_ID") || secrets.get("YOUTUBE_CLIENT_ID");
        const clientSecret = secrets.get("GOOGLE_CLIENT_SECRET") || secrets.get("YOUTUBE_CLIENT_SECRET");
        if (clientId && clientSecret) {
          const refreshed = await refreshYouTubeToken({
            clientId,
            clientSecret,
            refreshToken: String(creds.refresh_token),
          });
          accessToken = refreshed.access_token;
        }
      } catch (err) {
        console.warn("[syncSocialStats] youtube refresh warning", (err as Error)?.message || err);
      }
    }
    const ids = withMedia.map((p: Record<string, unknown>) => String(p.external_post_id));
    try {
      const statsList = await fetchYouTubeVideoStats({ accessToken, videoIds: ids });
      const byId = Object.fromEntries(statsList.map((s) => [s.id, s]));
      for (const post of withMedia) {
        const s = byId[String(post.external_post_id)];
        if (!s) {
          result.skipped += 1;
          continue;
        }
        await upsertAnalytics({
          base44: params.base44,
          campaignId: String(post.campaign_id),
          platform: "YouTube",
          contentType: "Shorts",
          views: s.viewCount,
          likes: s.likeCount,
          comments: s.commentCount,
          shares: 0,
          socialPostId: String(post.id),
          externalPostId: String(post.external_post_id),
          userId: String(account.user_id || post.user_id || ""),
        });
        result.upserted += 1;
      }
    } catch (err) {
      result.errors.push(`youtube:${(err as Error)?.message || err}`);
    }
    return result;
  }

  if (provider === "tiktok") {
    let accessToken = String(creds.access_token || "");
    if (creds.refresh_token) {
      try {
        const clientKey = secrets.get("TIKTOK_CLIENT_KEY") || secrets.get("TIKTOK_CLIENT_ID");
        const clientSecret = secrets.get("TIKTOK_CLIENT_SECRET");
        if (clientKey && clientSecret) {
          const refreshed = await refreshTikTokToken({
            clientKey,
            clientSecret,
            refreshToken: String(creds.refresh_token),
          });
          accessToken = refreshed.access_token;
        }
      } catch (err) {
        console.warn("[syncSocialStats] tiktok refresh warning", (err as Error)?.message || err);
      }
    }
    const ids = withMedia.map((p: Record<string, unknown>) => String(p.external_post_id));
    try {
      const videos = await fetchTikTokVideoList({ accessToken, videoIds: ids });
      const byId = Object.fromEntries(videos.map((v) => [v.id, v]));
      for (const post of withMedia) {
        const v = byId[String(post.external_post_id)];
        if (!v) {
          result.skipped += 1;
          continue;
        }
        await upsertAnalytics({
          base44: params.base44,
          campaignId: String(post.campaign_id),
          platform: "TikTok",
          contentType: "Short Video",
          views: v.view_count || 0,
          likes: v.like_count || 0,
          comments: v.comment_count || 0,
          shares: v.share_count || 0,
          socialPostId: String(post.id),
          externalPostId: String(post.external_post_id),
          userId: String(account.user_id || post.user_id || ""),
        });
        result.upserted += 1;
      }
    } catch (err) {
      result.errors.push(`tiktok:${(err as Error)?.message || err}`);
    }
    return result;
  }

  result.errors.push(`unsupported_provider:${provider}`);
  return result;
}
