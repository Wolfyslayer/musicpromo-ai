/**
 * Shared SocialPost publish pipeline (Instagram / TikTok / YouTube / X).
 * Used by socialPublish (user-invoked) and campaignWorker (cron).
 * Tokens never leave the backend.
 */
import { secrets } from "./runtime.ts";
import { localDateTimeInZoneToUtcIso, normalizeTimeZone } from "./timezone.ts";
import { decryptCredential } from "./socialCrypto.ts";
import { hasInstagramPublishScope } from "./instagramOAuth.ts";
import {
  assessMediaPublishability,
  normalizeInstagramPublishError,
  publishInstagramMedia,
  validateCaption,
  type PublishMediaType,
} from "./instagramPublishing.ts";
import {
  MediaPreparationError,
  prepareInstagramFeedImage,
} from "./mediaPreparation.ts";
import { fetchPublicMediaBytes } from "./mediaFetch.ts";
import {
  initTikTokVideoUpload,
  uploadTikTokVideoBytes,
  refreshTikTokToken,
} from "./tiktokOAuth.ts";
import { uploadYouTubeShort, refreshYouTubeToken } from "./youtubeOAuth.ts";
import {
  createXTweet,
  guessMediaMime,
  hasXPublishScope,
  refreshXToken,
  uploadXMedia,
} from "./xOAuth.ts";

// deno-lint-ignore no-explicit-any
export type Base44Client = any;

export type PublishCoreResult =
  | {
      ok: true;
      post: Record<string, unknown>;
      note?: string;
      mediaPreparation?: Record<string, unknown> | null;
    }
  | {
      ok: false;
      code: string;
      message: string;
      status: number;
      post?: Record<string, unknown>;
      needsReauth?: boolean;
    };

export function safeSocialPost(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    campaignId: row.campaign_id || null,
    campaignDayId: row.campaign_day_id || null,
    releaseId: row.release_id || null,
    socialAccountId: row.social_account_id || null,
    provider: row.provider,
    platform: row.platform || row.provider,
    contentType: row.content_type || null,
    caption: row.caption || "",
    mediaUrl: row.media_url || null,
    preparedMediaId: row.prepared_media_id || null,
    preparedMediaUrl: row.prepared_media_url || null,
    mediaType: row.media_type || "IMAGE",
    videoProjectId: row.video_project_id || null,
    generatedContentId: row.generated_content_id || null,
    status: row.status,
    scheduledAt: row.scheduled_at || null,
    publishedAt: row.published_at || null,
    externalPostId: row.external_post_id || null,
    externalPermalink: row.external_permalink || null,
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    createdDate: row.created_date || null,
    updatedDate: row.updated_date || null,
  };
}

const ALLOWED_PROVIDERS = new Set(["instagram", "tiktok", "youtube", "x"]);

function normalizeProviderId(raw: unknown): string {
  const p = String(raw || "").toLowerCase().trim();
  if (p === "twitter") return "x";
  return ALLOWED_PROVIDERS.has(p) ? p : "";
}

/** User-selected providers on a plan day, or infer from legacy single `platform` label. */
export function resolveDayPublishProviders(day: Record<string, unknown> | null | undefined): string[] {
  if (!day) return ["instagram", "tiktok", "youtube", "x"];
  const raw = day.publish_platforms ?? day.publishPlatforms;
  if (Array.isArray(raw) && raw.length) {
    const ids = raw.map(normalizeProviderId).filter(Boolean);
    if (ids.length) return [...new Set(ids)];
  }
  if (typeof raw === "string" && raw.trim()) {
    const ids = raw.split(/[,;\s]+/).map(normalizeProviderId).filter(Boolean);
    if (ids.length) return [...new Set(ids)];
  }
  return mapDayPlatformToProviders(day.platform as string);
}

/** Map CampaignDay.platform labels → SocialPost provider ids. */
export function mapDayPlatformToProviders(platform: string | null | undefined): string[] {
  const p = String(platform || "").toLowerCase();
  if (!p) return ["instagram", "tiktok", "youtube", "x"];
  if (p.includes("instagram") || p.includes("reels") || p === "ig") return ["instagram"];
  if (p.includes("tiktok")) return ["tiktok"];
  if (p.includes("youtube") || p.includes("shorts")) return ["youtube"];
  if (p.includes("twitter") || p === "x" || /\bx\b/.test(p)) return ["x"];
  if (p.includes("facebook")) return [];
  return ["instagram", "tiktok", "youtube", "x"];
}

export function buildDayCaption(day: Record<string, unknown> | null | undefined): string {
  if (!day) return "";
  const parts = [day.caption, day.hashtags, day.cta].filter((x) => x && String(x).trim());
  return parts.map((x) => String(x).trim()).join("\n\n");
}

/**
 * Combine CampaignDay.date (YYYY-MM-DD) + posting_time (HH:mm) into ISO UTC-ish local.
 * Falls back to `fallbackIso` or now+1h.
 */
export function resolveScheduledAt(
  day: Record<string, unknown>,
  fallbackIso?: string | null,
  timeZone?: string | null
): string {
  if (fallbackIso && !Number.isNaN(Date.parse(fallbackIso))) {
    return new Date(fallbackIso).toISOString();
  }
  const date = String(day.date || "").trim();
  const time = String(day.posting_time || "12:00").trim();
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  const hh = match ? String(match[1]).padStart(2, "0") : "12";
  const mm = match ? match[2] : "00";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const tzIso = timeZone
      ? localDateTimeInZoneToUtcIso(date, `${hh}:${mm}`, normalizeTimeZone(timeZone))
      : null;
    if (tzIso) return tzIso;
    const iso = `${date}T${hh}:${mm}:00`;
    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

async function markDayFromPost(
  base44: Base44Client,
  post: Record<string, unknown>,
  patch: Record<string, unknown>
) {
  const dayId = post.campaign_day_id ? String(post.campaign_day_id) : "";
  if (!dayId) return;
  try {
    await base44.asServiceRole.entities.CampaignDay.update(dayId, patch);
  } catch (err) {
    console.warn("[socialPublishCore] day update", (err as Error)?.message || err);
  }
}

/**
 * Publish one SocialPost using the owner's connected SocialAccount tokens.
 * Caller must ensure the post is eligible (draft | scheduled | failed).
 * Sets status publishing → published | failed.
 */
export async function publishSocialPostCore(params: {
  base44: Base44Client;
  postId: string;
  encryptionKey: string;
  /** When true, allow publishing from `scheduled` status (cron path). */
  allowScheduled?: boolean;
}): Promise<PublishCoreResult> {
  const { base44, postId, encryptionKey } = params;
  const allowScheduled = params.allowScheduled === true;

  try {
    const post = await base44.asServiceRole.entities.SocialPost.get(postId);
    if (!post) {
      return { ok: false, code: "NOT_FOUND", message: "Post not found.", status: 404 };
    }

    const provider = String(post.provider || "instagram").toLowerCase();
    if (!["instagram", "tiktok", "youtube", "x"].includes(provider)) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Unsupported publish provider.",
        status: 400,
      };
    }

    if (post.status === "published" || post.external_post_id) {
      return {
        ok: false,
        code: "DUPLICATE",
        message: "This post is already published.",
        status: 409,
        post: safeSocialPost(post),
      };
    }
    if (post.status === "publishing") {
      return {
        ok: false,
        code: "DUPLICATE",
        message: "This post is already publishing.",
        status: 409,
        post: safeSocialPost(post),
      };
    }

    const allowed = new Set(["draft", "failed"]);
    if (allowScheduled) allowed.add("scheduled");
    if (!allowed.has(String(post.status))) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Post cannot be published from this status.",
        status: 400,
        post: safeSocialPost(post),
      };
    }

    if (allowScheduled && String(post.status) === "scheduled") {
      const campaignId = post.campaign_id ? String(post.campaign_id) : "";
      if (campaignId) {
        let campaign: Record<string, unknown> | null = null;
        try {
          campaign = await base44.asServiceRole.entities.Campaign.get(campaignId);
        } catch {
          campaign = null;
        }
        if (!campaign) {
          const updated = await base44.asServiceRole.entities.SocialPost.update(postId, {
            status: "draft",
            scheduled_at: "",
            error_code: "CAMPAIGN_CANCELLED",
            error_message: "Campaign no longer exists.",
          });
          return {
            ok: false,
            code: "CAMPAIGN_CANCELLED",
            message: "Campaign no longer exists — auto-publish cancelled.",
            status: 410,
            post: safeSocialPost({ ...post, ...updated }),
          };
        }
      }
      const dayId = post.campaign_day_id ? String(post.campaign_day_id) : "";
      if (dayId) {
        let day: Record<string, unknown> | null = null;
        try {
          day = await base44.asServiceRole.entities.CampaignDay.get(dayId);
        } catch {
          day = null;
        }
        if (!day) {
          const updated = await base44.asServiceRole.entities.SocialPost.update(postId, {
            status: "draft",
            scheduled_at: "",
            error_code: "CAMPAIGN_CANCELLED",
            error_message: "Campaign day no longer exists.",
          });
          return {
            ok: false,
            code: "CAMPAIGN_CANCELLED",
            message: "Campaign day no longer exists — auto-publish cancelled.",
            status: 410,
            post: safeSocialPost({ ...post, ...updated }),
          };
        }
      }
    }

    const accounts = await base44.asServiceRole.entities.SocialAccount.filter(
      { user_id: post.user_id, provider },
      "-connected_at",
      20
    );
    const account = (accounts || []).find(
      (a: Record<string, unknown>) =>
        a.id === post.social_account_id || (!post.social_account_id && a.status === "connected")
    );
    if (!account) {
      return {
        ok: false,
        code: "NOT_CONFIGURED",
        message: `${provider} account not found.`,
        status: 400,
      };
    }
    if (account.status !== "connected") {
      return {
        ok: false,
        code: "NOT_CONFIGURED",
        message: `${provider} is not connected.`,
        status: 400,
      };
    }
    if (!account.encrypted_credentials) {
      return {
        ok: false,
        code: "INVALID_TOKEN",
        message: `${provider} credentials missing. Reconnect the account.`,
        status: 400,
      };
    }

    if (provider === "instagram" && !hasInstagramPublishScope(account.scopes)) {
      return {
        ok: false,
        code: "PERMISSION_DENIED",
        message:
          "Reconnect Instagram to grant publishing permission (instagram_business_content_publish).",
        status: 400,
        needsReauth: true,
      };
    }

    if (provider === "x" && !hasXPublishScope(account.scopes)) {
      return {
        ok: false,
        code: "PERMISSION_DENIED",
        message: "Reconnect X to grant tweet.write publishing permission.",
        status: 400,
        needsReauth: true,
      };
    }

    let videoProject: Record<string, unknown> | null = null;
    if (post.video_project_id) {
      try {
        videoProject = await base44.asServiceRole.entities.VideoProject.get(post.video_project_id);
      } catch {
        videoProject = null;
      }
    }

    const mediaType =
      (String(post.media_type || "IMAGE").toUpperCase() as PublishMediaType) || "IMAGE";
    const caption = String(post.caption || "").trim();

    // Claim the post (optimistic lock) — PROCESSING in product terms.
    await base44.asServiceRole.entities.SocialPost.update(postId, {
      status: "publishing",
      error_code: "",
      error_message: "",
      social_account_id: account.id,
    });
    await markDayFromPost(base44, post, {
      status: "processing",
      publish_error: "",
    });

    const locked = await base44.asServiceRole.entities.SocialPost.get(postId);
    if (!locked || locked.status !== "publishing") {
      return {
        ok: false,
        code: "DUPLICATE",
        message: "Could not start publishing.",
        status: 409,
      };
    }

    // --- X ---
    if (provider === "x") {
      let creds: Record<string, unknown>;
      try {
        creds = JSON.parse(await decryptCredential(account.encrypted_credentials, encryptionKey));
      } catch {
        await base44.asServiceRole.entities.SocialPost.update(postId, {
          status: "failed",
          error_code: "INVALID_TOKEN",
          error_message: "Could not decrypt X credentials.",
        });
        return {
          ok: false,
          code: "INVALID_TOKEN",
          message: "Could not decrypt X credentials.",
          status: 400,
        };
      }

      let accessToken = String(creds.access_token || "");
      const clientId =
        secrets.get("X_CLIENT_ID") ||
        secrets.get("TWITTER_CLIENT_ID") ||
        secrets.get("X_API_KEY");
      const clientSecret =
        secrets.get("X_CLIENT_SECRET") ||
        secrets.get("TWITTER_CLIENT_SECRET") ||
        secrets.get("X_API_SECRET");
      if (creds.refresh_token && clientId && clientSecret) {
        try {
          const refreshed = await refreshXToken({
            clientId,
            clientSecret,
            refreshToken: String(creds.refresh_token),
          });
          accessToken = refreshed.access_token;
        } catch (err) {
          console.warn("[socialPublishCore] x refresh", (err as Error)?.message || err);
        }
      }

      const videoUrl =
        (videoProject?.rendering_status === "complete" && videoProject?.render_output_url
          ? String(videoProject.render_output_url)
          : "") ||
        (mediaType === "VIDEO" || mediaType === "REELS" ? String(post.media_url || "") : "");
      const imageUrl =
        mediaType === "IMAGE" && post.media_url && /^https:\/\//i.test(String(post.media_url))
          ? String(post.media_url)
          : "";
      const publishMediaUrl = videoUrl || imageUrl;

      if (!caption && !publishMediaUrl) {
        await base44.asServiceRole.entities.SocialPost.update(postId, {
          status: "failed",
          error_code: "VALIDATION",
          error_message: "X posts need a caption and/or public HTTPS media.",
        });
        return {
          ok: false,
          code: "VALIDATION",
          message: "X posts need a caption and/or public HTTPS media.",
          status: 400,
        };
      }

      let mediaId: string | undefined;
      if (publishMediaUrl) {
        const bytes = await fetchPublicMediaBytes(publishMediaUrl);
        const mime = guessMediaMime(publishMediaUrl, videoUrl ? "REELS" : "IMAGE");
        mediaId = await uploadXMedia({ accessToken, bytes, mimeType: mime });
        await base44.asServiceRole.entities.SocialPost.update(postId, {
          media_url: publishMediaUrl,
          media_type: videoUrl ? "REELS" : "IMAGE",
        });
      }

      const posted = await createXTweet({ accessToken, text: caption, mediaId });
      const publishedAt = new Date().toISOString();
      const updated = await base44.asServiceRole.entities.SocialPost.update(postId, {
        status: "published",
        published_at: publishedAt,
        external_post_id: posted.tweetId,
        external_permalink: posted.permalink,
        container_id: posted.tweetId,
        error_code: "",
        error_message: "",
      });
      await markDayFromPost(base44, post, {
        status: "posted",
        publish_error: "",
        live_permalink: posted.permalink,
      });
      return {
        ok: true,
        post: safeSocialPost({
          ...post,
          ...updated,
          status: "published",
          published_at: publishedAt,
          external_post_id: posted.tweetId,
          external_permalink: posted.permalink,
        }),
      };
    }

    // --- TikTok / YouTube ---
    if (provider === "tiktok" || provider === "youtube") {
      const videoUrl =
        (videoProject?.rendering_status === "complete" && videoProject?.render_output_url
          ? String(videoProject.render_output_url)
          : "") ||
        (mediaType === "VIDEO" || mediaType === "REELS" ? String(post.media_url || "") : "");
      if (!videoUrl || !/^https:\/\//i.test(videoUrl)) {
        await base44.asServiceRole.entities.SocialPost.update(postId, {
          status: "failed",
          error_code: "MEDIA_NOT_READY",
          error_message: `${provider} publishing requires a public HTTPS MP4 (VideoProject or REELS media).`,
        });
        await markDayFromPost(base44, post, {
          status: "failed",
          publish_error: "Video not ready for auto-publish.",
        });
        return {
          ok: false,
          code: "MEDIA_NOT_READY",
          message: `${provider} publishing requires a public HTTPS MP4 (VideoProject or REELS media).`,
          status: 400,
        };
      }

      await base44.asServiceRole.entities.SocialPost.update(postId, {
        media_url: videoUrl,
        media_type: "REELS",
      });

      let creds: Record<string, unknown>;
      try {
        creds = JSON.parse(await decryptCredential(account.encrypted_credentials, encryptionKey));
      } catch {
        await base44.asServiceRole.entities.SocialPost.update(postId, {
          status: "failed",
          error_code: "INVALID_TOKEN",
          error_message: `Could not decrypt ${provider} credentials.`,
        });
        return {
          ok: false,
          code: "INVALID_TOKEN",
          message: `Could not decrypt ${provider} credentials.`,
          status: 400,
        };
      }

      const videoBytes = await fetchPublicMediaBytes(videoUrl);

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
            console.warn("[socialPublishCore] tiktok refresh", (err as Error)?.message || err);
          }
        }
        const init = await initTikTokVideoUpload({
          accessToken,
          videoSize: videoBytes.byteLength,
        });
        await uploadTikTokVideoBytes({ uploadUrl: init.upload_url, bytes: videoBytes });
        const publishedAt = new Date().toISOString();
        const updated = await base44.asServiceRole.entities.SocialPost.update(postId, {
          status: "published",
          published_at: publishedAt,
          external_post_id: init.publish_id,
          external_permalink: "",
          container_id: init.publish_id,
          error_code: "",
          error_message: "",
        });
        await markDayFromPost(base44, post, {
          status: "posted",
          publish_error: "",
          live_permalink: "",
        });
        return {
          ok: true,
          post: safeSocialPost({
            ...post,
            ...updated,
            status: "published",
            published_at: publishedAt,
            external_post_id: init.publish_id,
          }),
          note: "TikTok inbox/draft upload initialized (Content Posting API v2).",
        };
      }

      // YouTube Shorts
      let accessToken = String(creds.access_token || "");
      if (creds.refresh_token) {
        try {
          const clientId = secrets.get("GOOGLE_CLIENT_ID") || secrets.get("YOUTUBE_CLIENT_ID");
          const clientSecret =
            secrets.get("GOOGLE_CLIENT_SECRET") || secrets.get("YOUTUBE_CLIENT_SECRET");
          if (clientId && clientSecret) {
            const refreshed = await refreshYouTubeToken({
              clientId,
              clientSecret,
              refreshToken: String(creds.refresh_token),
            });
            accessToken = refreshed.access_token;
          }
        } catch (err) {
          console.warn("[socialPublishCore] youtube refresh", (err as Error)?.message || err);
        }
      }
      const uploaded = await uploadYouTubeShort({
        accessToken,
        videoBytes,
        title: caption || "Promo Short",
        description: caption,
        privacyStatus: "public",
      });
      const publishedAt = new Date().toISOString();
      const permalink = `https://youtube.com/shorts/${uploaded.videoId}`;
      const updated = await base44.asServiceRole.entities.SocialPost.update(postId, {
        status: "published",
        published_at: publishedAt,
        external_post_id: uploaded.videoId,
        external_permalink: permalink,
        container_id: uploaded.videoId,
        error_code: "",
        error_message: "",
      });
      await markDayFromPost(base44, post, {
        status: "posted",
        publish_error: "",
        live_permalink: permalink,
      });
      return {
        ok: true,
        post: safeSocialPost({
          ...post,
          ...updated,
          status: "published",
          published_at: publishedAt,
          external_post_id: uploaded.videoId,
          external_permalink: permalink,
        }),
      };
    }

    // --- Instagram ---
    const mediaCheck = assessMediaPublishability({
      mediaUrl: post.media_url,
      mediaType,
      videoProject,
    });
    if (!mediaCheck.ok) {
      await base44.asServiceRole.entities.SocialPost.update(postId, {
        status: "failed",
        error_code: mediaCheck.code || "INVALID_MEDIA",
        error_message: mediaCheck.message || "Media not publishable.",
      });
      await markDayFromPost(base44, post, {
        status: "failed",
        publish_error: mediaCheck.message || "Media not publishable.",
      });
      return {
        ok: false,
        code: mediaCheck.code || "INVALID_MEDIA",
        message: mediaCheck.message || "Media not publishable.",
        status: 400,
        post: safeSocialPost({
          ...post,
          status: "failed",
          error_code: mediaCheck.code,
          error_message: mediaCheck.message,
        }),
      };
    }

    let igCaption = "";
    try {
      igCaption = validateCaption(post.caption);
    } catch (e) {
      const norm = normalizeInstagramPublishError(e);
      await base44.asServiceRole.entities.SocialPost.update(postId, {
        status: "failed",
        error_code: norm.code,
        error_message: norm.message,
      });
      return { ok: false, code: norm.code, message: norm.message, status: 400 };
    }

    let publishUrl = String(post.media_url);
    let preparedMediaId = post.prepared_media_id || "";
    let preparedMediaUrl = post.prepared_media_url || "";

    if (mediaType === "IMAGE") {
      try {
        const prepared = await prepareInstagramFeedImage({
          base44,
          userId: String(post.user_id),
          sourceUrl: String(post.media_url),
          purpose: "instagram_feed_image",
        });
        publishUrl = prepared.preparedUrl;
        preparedMediaId = prepared.id;
        preparedMediaUrl = prepared.preparedUrl;
        await base44.asServiceRole.entities.SocialPost.update(postId, {
          prepared_media_id: preparedMediaId,
          prepared_media_url: preparedMediaUrl,
        });
      } catch (prepErr) {
        const code =
          prepErr instanceof MediaPreparationError ? prepErr.code : "MEDIA_PREPARATION_FAILED";
        const message =
          prepErr instanceof MediaPreparationError
            ? prepErr.message
            : "Could not prepare artwork for Instagram.";
        await base44.asServiceRole.entities.SocialPost.update(postId, {
          status: "failed",
          error_code: code,
          error_message: message,
        });
        await markDayFromPost(base44, post, { status: "failed", publish_error: message });
        return { ok: false, code, message, status: 400 };
      }
    }

    let accessToken = "";
    let igUserId = String(account.provider_account_id || "");
    try {
      const raw = await decryptCredential(account.encrypted_credentials, encryptionKey);
      const parsed = JSON.parse(raw);
      accessToken =
        parsed?.access_token || parsed?.page_access_token || parsed?.user_access_token || "";
      if (parsed?.ig_user_id) igUserId = String(parsed.ig_user_id);
    } catch {
      await base44.asServiceRole.entities.SocialPost.update(postId, {
        status: "failed",
        error_code: "INVALID_TOKEN",
        error_message: "Could not decrypt Instagram credentials. Reconnect the account.",
      });
      return {
        ok: false,
        code: "INVALID_TOKEN",
        message: "Could not decrypt Instagram credentials. Reconnect the account.",
        status: 400,
      };
    }
    if (!accessToken || !igUserId) {
      const message = !accessToken
        ? "Instagram access token missing. Reconnect the account."
        : "Instagram user id missing. Reconnect Instagram.";
      await base44.asServiceRole.entities.SocialPost.update(postId, {
        status: "failed",
        error_code: "INVALID_TOKEN",
        error_message: message,
      });
      return { ok: false, code: "INVALID_TOKEN", message, status: 400 };
    }

    const result = await publishInstagramMedia({
      igUserId,
      accessToken,
      mediaUrl: publishUrl,
      mediaType: mediaType === "VIDEO" || mediaType === "REELS" ? mediaType : "IMAGE",
      caption: igCaption,
    });

    const publishedAt = new Date().toISOString();
    const updated = await base44.asServiceRole.entities.SocialPost.update(postId, {
      status: "published",
      published_at: publishedAt,
      external_post_id: result.mediaId,
      external_permalink: result.permalink || "",
      container_id: result.containerId,
      prepared_media_id: preparedMediaId || "",
      prepared_media_url: preparedMediaUrl || "",
      error_code: "",
      error_message: "",
    });
    await markDayFromPost(base44, post, {
      status: "posted",
      publish_error: "",
      live_permalink: result.permalink || "",
    });

    return {
      ok: true,
      post: safeSocialPost({
        ...post,
        ...updated,
        status: "published",
        published_at: publishedAt,
        external_post_id: result.mediaId,
        external_permalink: result.permalink || "",
        container_id: result.containerId,
        prepared_media_id: preparedMediaId,
        prepared_media_url: preparedMediaUrl,
      }),
      mediaPreparation: preparedMediaUrl
        ? { preparedMediaId, preparedMediaUrl }
        : null,
    };
  } catch (error) {
    const norm = normalizeInstagramPublishError(error);
    console.error("[socialPublishCore]", norm.code, norm.message);
    try {
      await params.base44.asServiceRole.entities.SocialPost.update(params.postId, {
        status: "failed",
        error_code: norm.code,
        error_message: norm.message,
      });
      const failed = await params.base44.asServiceRole.entities.SocialPost.get(params.postId);
      if (failed?.campaign_day_id) {
        await markDayFromPost(params.base44, failed, {
          status: "failed",
          publish_error: norm.message,
        });
      }
    } catch {
      /* ignore */
    }
    return { ok: false, code: norm.code, message: norm.message, status: 502 };
  }
}
