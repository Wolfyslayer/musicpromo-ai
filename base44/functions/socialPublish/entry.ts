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
 * Publish a SocialPost to Instagram (Instagram Login Content Publishing API).
 * IMAGE posts: MediaPreparation produces a public JPEG when needed, then Meta publish.
 * Tokens never leave this function.
 */
export default async function (req: Request): Promise<Response> {
  let postId = "";
  let base44: ReturnType<typeof createClientFromRequest> | null = null;

  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    postId = body?.postId ? String(body.postId) : "";
    if (!postId) {
      return Response.json({ error: "postId is required." }, { status: 400 });
    }

    const encryptionKey = secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
    if (!encryptionKey) {
      return Response.json({ error: "Publishing is not configured.", code: "NOT_CONFIGURED" }, { status: 503 });
    }

    const post = await base44.asServiceRole.entities.SocialPost.get(postId);
    if (!post || post.user_id !== user.id) {
      return Response.json({ error: "Post not found." }, { status: 404 });
    }

    if (post.provider !== "instagram") {
      return Response.json({ error: "Only Instagram publishing is supported.", code: "VALIDATION" }, { status: 400 });
    }

    if (post.status === "published" || post.external_post_id) {
      return Response.json(
        { error: "This post is already published.", code: "DUPLICATE", post: safePost(post) },
        { status: 409 }
      );
    }
    if (post.status === "publishing") {
      return Response.json(
        { error: "This post is already publishing.", code: "DUPLICATE", post: safePost(post) },
        { status: 409 }
      );
    }
    if (post.status !== "draft" && post.status !== "failed") {
      return Response.json({ error: "Post cannot be published from this status.", code: "VALIDATION" }, { status: 400 });
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
      return Response.json({ error: "Instagram account not found.", code: "NOT_CONFIGURED" }, { status: 400 });
    }
    if (account.status !== "connected") {
      return Response.json({ error: "Instagram is not connected.", code: "NOT_CONFIGURED" }, { status: 400 });
    }
    if (!hasInstagramPublishScope(account.scopes)) {
      return Response.json(
        {
          error: "Reconnect Instagram to grant publishing permission (instagram_business_content_publish).",
          code: "PERMISSION_DENIED",
          needsReauth: true,
        },
        { status: 403 }
      );
    }
    if (!account.encrypted_credentials) {
      return Response.json({ error: "Instagram credentials missing. Reconnect the account.", code: "INVALID_TOKEN" }, { status: 400 });
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
      return Response.json(
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
        { status: 400 }
      );
    }

    let caption = "";
    try {
      caption = validateCaption(post.caption);
    } catch (e) {
      const norm = normalizeInstagramPublishError(e);
      return Response.json({ error: norm.message, code: norm.code }, { status: 400 });
    }

    await base44.asServiceRole.entities.SocialPost.update(postId, {
      status: "publishing",
      error_code: "",
      error_message: "",
      social_account_id: account.id,
    });

    const locked = await base44.asServiceRole.entities.SocialPost.get(postId);
    if (!locked || locked.user_id !== user.id || locked.status !== "publishing") {
      return Response.json({ error: "Could not start publishing.", code: "DUPLICATE" }, { status: 409 });
    }

    // Resolve publishable HTTPS JPEG for IMAGE posts via MediaPreparation
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
        return Response.json(
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
          { status: 400 }
        );
      }
    }

    let accessToken = "";
    try {
      const raw = await decryptCredential(account.encrypted_credentials, encryptionKey);
      const parsed = JSON.parse(raw);
      accessToken = parsed?.access_token || "";
    } catch {
      await base44.asServiceRole.entities.SocialPost.update(postId, {
        status: "failed",
        error_code: "INVALID_TOKEN",
        error_message: "Could not decrypt Instagram credentials. Reconnect the account.",
      });
      return Response.json(
        { error: "Could not decrypt Instagram credentials. Reconnect the account.", code: "INVALID_TOKEN" },
        { status: 400 }
      );
    }
    if (!accessToken) {
      await base44.asServiceRole.entities.SocialPost.update(postId, {
        status: "failed",
        error_code: "INVALID_TOKEN",
        error_message: "Instagram access token missing. Reconnect the account.",
      });
      return Response.json({ error: "Instagram access token missing. Reconnect the account.", code: "INVALID_TOKEN" }, { status: 400 });
    }

    const result = await publishInstagramMedia({
      igUserId: String(account.provider_account_id),
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

    return Response.json({
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
    return Response.json({ error: norm.message, code: norm.code }, { status: 502 });
  }
}
