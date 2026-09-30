import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { INSTAGRAM_CAPTION_MAX } from "../../shared/instagramPublishing.ts";

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
 * Update a draft/failed SocialPost owned by the authenticated user.
 * Does NOT enforce Instagram publish-media rules (JPEG / public HTTPS).
 * Those apply only in socialPublish.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const postId = body?.postId ? String(body.postId) : "";
    if (!postId) {
      return Response.json({ error: "postId is required." }, { status: 400 });
    }

    const post = await base44.asServiceRole.entities.SocialPost.get(postId);
    if (!post || post.user_id !== user.id) {
      return Response.json({ error: "Post not found." }, { status: 404 });
    }
    if (post.status === "published" || post.status === "publishing") {
      return Response.json(
        { error: "Published or in-progress posts cannot be edited.", code: "DUPLICATE" },
        { status: 409 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.caption != null) {
      const caption = String(body.caption);
      if (caption.length > INSTAGRAM_CAPTION_MAX) {
        return Response.json(
          { error: `Caption exceeds ${INSTAGRAM_CAPTION_MAX} characters.`, code: "VALIDATION" },
          { status: 400 }
        );
      }
      updates.caption = caption;
    }
    if (body.mediaUrl != null) updates.media_url = String(body.mediaUrl);
    if (body.mediaType != null) {
      const mt = String(body.mediaType).toUpperCase();
      updates.media_type = mt === "VIDEO" || mt === "REELS" ? mt : "IMAGE";
    }
    if (body.socialAccountId != null && String(body.socialAccountId).trim()) {
      const owned = await base44.asServiceRole.entities.SocialAccount.filter(
        { user_id: user.id, provider: "instagram" },
        "-connected_at",
        20
      );
      const match = (owned || []).find((a) => a.id === String(body.socialAccountId) && a.status === "connected");
      if (!match) {
        return Response.json({ error: "Social account not found." }, { status: 400 });
      }
      updates.social_account_id = match.id;
    }
    if (body.generatedContentId != null) updates.generated_content_id = String(body.generatedContentId);
    if (body.videoProjectId != null) updates.video_project_id = String(body.videoProjectId);
    if (body.contentType != null) updates.content_type = String(body.contentType);

    // Clear prior failure when editing a failed draft for retry
    if (post.status === "failed") {
      updates.status = "draft";
      updates.error_code = "";
      updates.error_message = "";
    }

    const updated = await base44.asServiceRole.entities.SocialPost.update(postId, updates);
    const merged = { ...post, ...updates, ...updated };

    return Response.json({
      post: safePost(merged),
      ok: true,
    });
  } catch (error) {
    console.error("[socialPostUpdate]", error?.message || "update failed");
    return Response.json({ error: "Could not update social post." }, { status: 500 });
  }
}
