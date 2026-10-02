import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest } from "../_shared/runtime.ts";
import { INSTAGRAM_CAPTION_MAX } from "../_shared/instagramPublishing.ts";
import { recordOwnedByUser } from "../_shared/ownership.ts";

function buildSuggestedCaption(day: Record<string, unknown> | null): string {
  if (!day) return "";
  const parts = [day.caption, day.hashtags, day.cta].filter((p) => p && String(p).trim());
  return parts.map((p) => String(p).trim()).join("\n\n").slice(0, INSTAGRAM_CAPTION_MAX);
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
 * Create a SocialPost draft. Ownership bound to authenticated user.
 * Does NOT call Meta. Does NOT enforce Instagram publish-media rules
 * (JPEG / public HTTPS / publish scopes) — those apply only in socialPublish.
 */
async function handler (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider || "instagram").toLowerCase();
    if (provider !== "instagram") {
      return Response.json({ error: "Only Instagram publishing is available in this phase." }, { status: 400 });
    }

    // Optional for drafts: attach a connected account when available.
    // Publish permission / media readiness are NOT required to save a draft.
    let socialAccountId = "";
    const accounts = await base44.asServiceRole.entities.SocialAccount.filter(
      { user_id: user.id, provider: "instagram", status: "connected" },
      "-connected_at",
      10
    );
    const requestedId = body?.socialAccountId ? String(body.socialAccountId) : "";
    if (requestedId) {
      const match = (accounts || []).find((a) => a.id === requestedId);
      if (!match) {
        return Response.json({ error: "Social account not found.", code: "VALIDATION" }, { status: 400 });
      }
      socialAccountId = match.id;
    } else if ((accounts || []).length) {
      socialAccountId = accounts[0].id;
    }

    let campaignId = body?.campaignId ? String(body.campaignId) : "";
    let campaignDayId = body?.campaignDayId ? String(body.campaignDayId) : "";
    let releaseId = body?.releaseId ? String(body.releaseId) : "";
    let contentType = body?.contentType ? String(body.contentType) : "";
    let caption = body?.caption != null ? String(body.caption) : "";
    let mediaUrl = body?.mediaUrl != null ? String(body.mediaUrl) : "";
    let mediaType = String(body?.mediaType || "IMAGE").toUpperCase();
    let videoProjectId = body?.videoProjectId ? String(body.videoProjectId) : "";
    let generatedContentId = body?.generatedContentId ? String(body.generatedContentId) : "";

    let day: Record<string, unknown> | null = null;
    if (campaignDayId) {
      try {
        day = await base44.asServiceRole.entities.CampaignDay.get(campaignDayId);
      } catch {
        day = null;
      }
      if (day) {
        campaignId = campaignId || String(day.campaign_id || "");
        contentType = contentType || String(day.content_type || day.platform || "");
        if (!caption) caption = buildSuggestedCaption(day);
        if (!videoProjectId && day.video_project_id) videoProjectId = String(day.video_project_id);
      }
    }

    if (campaignId) {
      try {
        const campaign = await base44.asServiceRole.entities.Campaign.get(campaignId);
        if (!campaign || !recordOwnedByUser(campaign, user)) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!releaseId && campaign.release_id) releaseId = String(campaign.release_id);
      } catch {
        return Response.json({ error: "Campaign not found." }, { status: 404 });
      }
    }

    if (campaignDayId && day && !recordOwnedByUser(day, user) && campaignId) {
      // Day may lack user_id on older rows; campaign ownership already enforced above.
    } else if (campaignDayId && day && !recordOwnedByUser(day, user) && !campaignId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (generatedContentId && !caption) {
      try {
        const gc = await base44.asServiceRole.entities.GeneratedContent.get(generatedContentId);
        if (gc?.content) caption = String(gc.content).slice(0, INSTAGRAM_CAPTION_MAX);
      } catch {
        /* optional */
      }
    }

    // Prefer public artwork when no media selected (any format OK for drafts)
    if (!mediaUrl && (releaseId || campaignId)) {
      try {
        if (releaseId) {
          const release = await base44.asServiceRole.entities.Release.get(releaseId);
          if (release?.artwork_url) mediaUrl = String(release.artwork_url);
        }
        if (!mediaUrl && campaignId) {
          const campaign = await base44.asServiceRole.entities.Campaign.get(campaignId);
          if (campaign?.song_id) {
            const song = await base44.asServiceRole.entities.Song.get(campaign.song_id);
            if (song?.artwork_url) mediaUrl = String(song.artwork_url);
          }
        }
      } catch {
        /* optional */
      }
    }

    if (videoProjectId) {
      try {
        const videoProject = await base44.asServiceRole.entities.VideoProject.get(videoProjectId);
        if (
          videoProject &&
          videoProject.rendering_status === "complete" &&
          videoProject.render_output_url &&
          (mediaType === "VIDEO" || mediaType === "REELS")
        ) {
          mediaUrl = String(videoProject.render_output_url);
        } else if (mediaType === "VIDEO" || mediaType === "REELS") {
          // Incomplete video stays draftable as IMAGE placeholder (publish will validate later)
          mediaType = "IMAGE";
        }
      } catch {
        /* optional */
      }
    }

    if (caption.length > INSTAGRAM_CAPTION_MAX) {
      return Response.json(
        { error: `Caption exceeds ${INSTAGRAM_CAPTION_MAX} characters.`, code: "VALIDATION" },
        { status: 400 }
      );
    }

    const row = await base44.asServiceRole.entities.SocialPost.create({
      user_id: user.id,
      campaign_id: campaignId || "",
      campaign_day_id: campaignDayId || "",
      release_id: releaseId || "",
      social_account_id: socialAccountId || "",
      provider: "instagram",
      platform: "instagram",
      content_type: contentType || "",
      caption: caption || "",
      media_url: mediaUrl || "",
      media_type: mediaType === "VIDEO" || mediaType === "REELS" ? mediaType : "IMAGE",
      video_project_id: videoProjectId || "",
      generated_content_id: generatedContentId || "",
      status: "draft",
      error_code: "",
      error_message: "",
    });

    return Response.json({
      post: safePost(row),
      ok: true,
    });
  } catch (error) {
    console.error("[socialPostCreate]", error?.message || "create failed");
    return Response.json({ error: "Could not create social post." }, { status: 500 });
  }
}


serveWithCors(handler);
