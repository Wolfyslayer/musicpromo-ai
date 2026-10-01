import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { secrets } from "base44:runtime";
import { decryptCredential } from "../../shared/socialCrypto.ts";
import { hasInstagramPublishScope } from "../../shared/instagramOAuth.ts";
import {
  assessMediaPublishability,
  normalizeInstagramPublishError,
  publishInstagramMedia,
  validateCaption,
  type PublishMediaType,
} from "../../shared/instagramPublishing.ts";
import {
  MediaPreparationError,
  prepareInstagramFeedImage,
} from "../../shared/mediaPreparation.ts";

/** Allow SPA origins (local Vite + production) with credentialed POSTs. */
function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") || req.headers.get("origin") || "";
  const allowOrigin =
    origin &&
    (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
      origin.includes("base44.app") ||
      origin.includes("flying-sonic-promo-flow"))
      ? origin
      : origin || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-Requested-With",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200
): Response {
  return Response.json(body, { status, headers: corsHeaders(req) });
}

function safePost(row: Record<string, unknown>) {
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
    publishedAt: row.published_at || null,
    externalPostId: row.external_post_id || null,
    externalPermalink: row.external_permalink || null,
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    createdDate: row.created_date || null,
    updatedDate: row.updated_date || null,
  };
}

/**
 * Publish a SocialPost to Instagram (Instagram Login + graph.instagram.com).
 * Requires an authenticated Base44 user session (Authorization Bearer and/or cookies).
 * IMAGE posts: MediaPreparation produces a public JPEG when needed, then Meta publish.
 * REELS/VIDEO: async container → poll FINISHED → media_publish.
 * Tokens never leave this function.
 */
export default async function (req: Request): Promise<Response> {
  // Preflight for credentialed cross-origin POSTs from local / production SPA.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed.", code: "VALIDATION" }, 405);
  }

  let postId = "";
  let base44: ReturnType<typeof createClientFromRequest> | null = null;

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const hasBearer = /^Bearer\s+\S+/i.test(authHeader);
    console.log(
      "[socialPublish] auth_context",
      JSON.stringify({
        method: req.method,
        hasAuthorizationHeader: Boolean(authHeader),
        hasBearer,
        origin: req.headers.get("Origin") || null,
      })
    );

    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      console.error(
        "[socialPublish] Unauthorized — createClientFromRequest could not resolve session user",
        JSON.stringify({ hasBearer, hasAuthorizationHeader: Boolean(authHeader) })
      );
      return jsonResponse(
        req,
        {
          error: "Unauthorized. Sign in again, then retry publish.",
          code: "UNAUTHORIZED",
        },
        401
      );
    }

    const body = await req.json().catch(() => ({}));
    postId = body?.postId ? String(body.postId) : "";
    if (!postId) {
      return jsonResponse(req, { error: "postId is required." }, 400);
    }

    const encryptionKey = secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
    if (!encryptionKey) {
      return jsonResponse(
        req,
        { error: "Publishing is not configured.", code: "NOT_CONFIGURED" },
        503
      );
    }

    const post = await base44.asServiceRole.entities.SocialPost.get(postId);
    if (!post || post.user_id !== user.id) {
      return jsonResponse(req, { error: "Post not found." }, 404);
    }

    if (post.provider !== "instagram") {
      return jsonResponse(
        req,
        { error: "Only Instagram publishing is supported.", code: "VALIDATION" },
        400
      );
    }

    if (post.status === "published" || post.external_post_id) {
      return jsonResponse(
        req,
        { error: "This post is already published.", code: "DUPLICATE", post: safePost(post) },
        409
      );
    }
    if (post.status === "publishing") {
      return jsonResponse(
        req,
        { error: "This post is already publishing.", code: "DUPLICATE", post: safePost(post) },
        409
      );
    }
    if (post.status !== "draft" && post.status !== "failed") {
      return jsonResponse(
        req,
        { error: "Post cannot be published from this status.", code: "VALIDATION" },
        400
      );
    }

    const accounts = await base44.asServiceRole.entities.SocialAccount.filter(
      { user_id: user.id, provider: "instagram" },
      "-connected_at",
      20
    );
    const account = (accounts || []).find(
      (a) => a.id === post.social_account_id || (!post.social_account_id && a.status === "connected")
    );
    if (!account || account.user_id !== user.id) {
      return jsonResponse(
        req,
        { error: "Instagram account not found.", code: "NOT_CONFIGURED" },
        400
      );
    }
    if (account.status !== "connected") {
      return jsonResponse(
        req,
        { error: "Instagram is not connected.", code: "NOT_CONFIGURED" },
        400
      );
    }
    // Use 400 (not 403) so browsers/SDK don't treat missing IG scopes as a platform auth block.
    if (!hasInstagramPublishScope(account.scopes)) {
      return jsonResponse(
        req,
        {
          error:
            "Reconnect Instagram to grant publishing permission (instagram_business_content_publish).",
          code: "PERMISSION_DENIED",
          needsReauth: true,
        },
        400
      );
    }
    if (!account.encrypted_credentials) {
      return jsonResponse(
        req,
        { error: "Instagram credentials missing. Reconnect the account.", code: "INVALID_TOKEN" },
        400
      );
    }

    let videoProject = null;
    if (post.video_project_id) {
      try {
        videoProject = await base44.asServiceRole.entities.VideoProject.get(post.video_project_id);
      } catch {
        videoProject = null;
      }
    }

    const mediaType = (String(post.media_type || "IMAGE").toUpperCase() as PublishMediaType) || "IMAGE";
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
      return jsonResponse(
        req,
        {
          error: mediaCheck.message,
          code: mediaCheck.code || "INVALID_MEDIA",
          post: safePost({
            ...post,
            status: "failed",
            error_code: mediaCheck.code,
            error_message: mediaCheck.message,
          }),
        },
        400
      );
    }

    let caption = "";
    try {
      caption = validateCaption(post.caption);
    } catch (e) {
      const norm = normalizeInstagramPublishError(e);
      return jsonResponse(req, { error: norm.message, code: norm.code }, 400);
    }

    await base44.asServiceRole.entities.SocialPost.update(postId, {
      status: "publishing",
      error_code: "",
      error_message: "",
      social_account_id: account.id,
    });

    const locked = await base44.asServiceRole.entities.SocialPost.get(postId);
    if (!locked || locked.user_id !== user.id || locked.status !== "publishing") {
      return jsonResponse(req, { error: "Could not start publishing.", code: "DUPLICATE" }, 409);
    }

    let publishUrl = String(post.media_url);
    let preparedMediaId = post.prepared_media_id || "";
    let preparedMediaUrl = post.prepared_media_url || "";

    if (mediaType === "IMAGE") {
      try {
        const prepared = await prepareInstagramFeedImage({
          base44,
          userId: user.id,
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
        return jsonResponse(
          req,
          {
            error: message,
            code,
            post: safePost({
              ...post,
              status: "failed",
              error_code: code,
              error_message: message,
            }),
          },
          400
        );
      }
    }

    let accessToken = "";
    let igUserId = String(account.provider_account_id || "");
    try {
      const raw = await decryptCredential(account.encrypted_credentials, encryptionKey);
      const parsed = JSON.parse(raw);
      accessToken =
        parsed?.access_token || parsed?.page_access_token || parsed?.user_access_token || "";
      if (parsed?.ig_user_id) {
        igUserId = String(parsed.ig_user_id);
      }
    } catch {
      await base44.asServiceRole.entities.SocialPost.update(postId, {
        status: "failed",
        error_code: "INVALID_TOKEN",
        error_message: "Could not decrypt Instagram credentials. Reconnect the account.",
      });
      return jsonResponse(
        req,
        {
          error: "Could not decrypt Instagram credentials. Reconnect the account.",
          code: "INVALID_TOKEN",
        },
        400
      );
    }
    if (!accessToken) {
      await base44.asServiceRole.entities.SocialPost.update(postId, {
        status: "failed",
        error_code: "INVALID_TOKEN",
        error_message: "Instagram access token missing. Reconnect the account.",
      });
      return jsonResponse(
        req,
        { error: "Instagram access token missing. Reconnect the account.", code: "INVALID_TOKEN" },
        400
      );
    }
    if (!igUserId) {
      await base44.asServiceRole.entities.SocialPost.update(postId, {
        status: "failed",
        error_code: "NOT_CONFIGURED",
        error_message: "Instagram user id missing. Reconnect Instagram.",
      });
      return jsonResponse(
        req,
        { error: "Instagram user id missing. Reconnect Instagram.", code: "NOT_CONFIGURED" },
        400
      );
    }

    const result = await publishInstagramMedia({
      igUserId,
      accessToken,
      mediaUrl: publishUrl,
      mediaType: mediaType === "VIDEO" || mediaType === "REELS" ? mediaType : "IMAGE",
      caption,
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

    return jsonResponse(req, {
      ok: true,
      post: safePost({
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
        ? { preparedMediaId, preparedMediaUrl, reused: undefined }
        : null,
    });
  } catch (error) {
    const norm = normalizeInstagramPublishError(error);
    console.error("[socialPublish]", norm.code, norm.message);
    if (base44 && postId) {
      try {
        await base44.asServiceRole.entities.SocialPost.update(postId, {
          status: "failed",
          error_code: norm.code,
          error_message: norm.message,
        });
      } catch {
        /* ignore secondary failure */
      }
    }
    return jsonResponse(req, { error: norm.message, code: norm.code, ok: false }, 502);
  }
}
