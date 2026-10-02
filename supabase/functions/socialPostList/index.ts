import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest } from "../_shared/runtime.ts";
import { assessMediaPublishability } from "../_shared/instagramPublishing.ts";

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

/**
 * List SocialPosts for the authenticated user (safe metadata only).
 */
async function handler (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const status = body?.status ? String(body.status) : null;
    const campaignId = body?.campaignId ? String(body.campaignId) : null;
    const postId = body?.postId ? String(body.postId) : null;

    if (postId) {
      const post = await base44.asServiceRole.entities.SocialPost.get(postId);
      if (!post || post.user_id !== user.id) {
        return Response.json({ error: "Post not found." }, { status: 404 });
      }
      let videoProject = null;
      if (post.video_project_id) {
        try {
          videoProject = await base44.asServiceRole.entities.VideoProject.get(post.video_project_id);
        } catch {
          videoProject = null;
        }
      }
      const mediaCheck = assessMediaPublishability({
        mediaUrl: post.media_url,
        mediaType: post.media_type,
        videoProject,
      });
      return Response.json({
        post: safePost(post),
        mediaReady: mediaCheck.ok,
        mediaIssue: mediaCheck.ok ? null : { code: mediaCheck.code, message: mediaCheck.message },
      });
    }

    const filter: Record<string, string> = { user_id: user.id };
    if (status) filter.status = status;
    if (campaignId) filter.campaign_id = campaignId;

    const rows = await base44.asServiceRole.entities.SocialPost.filter(
      filter,
      "-created_date",
      100
    );

    return Response.json({
      posts: (rows || []).map(safePost),
    });
  } catch (error) {
    console.error("[socialPostList]", error?.message || "list failed");
    return Response.json({ error: "Could not load social posts." }, { status: 500 });
  }
}


serveWithCors(handler);
