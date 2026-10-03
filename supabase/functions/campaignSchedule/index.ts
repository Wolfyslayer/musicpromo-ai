import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest } from "../_shared/runtime.ts";
import {
  buildDayCaption,
  mapDayPlatformToProviders,
  resolveScheduledAt,
  safeSocialPost,
} from "../_shared/socialPublishCore.ts";
import { pickSocialAccountForArtist } from "../_shared/socialAccountScope.ts";
import { recordOwnedByUser } from "../_shared/ownership.ts";
import { kickCampaignWorkerAsync } from "../_shared/kickCampaignWorker.ts";

/**
 * Schedule a CampaignDay for automatic multi-platform publish via campaignWorker.
 * Creates SocialPost rows (status=scheduled) for each connected provider.
 *
 * Body: { campaignDayId, scheduledAt?, providers?: string[] }
 */
async function handler (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const campaignDayId = body?.campaignDayId ? String(body.campaignDayId) : "";
    if (!campaignDayId) {
      return Response.json({ error: "campaignDayId is required." }, { status: 400 });
    }

    const day = await base44.asServiceRole.entities.CampaignDay.get(campaignDayId);
    if (!day) {
      return Response.json({ error: "Campaign day not found." }, { status: 404 });
    }

    if (["processing", "posted"].includes(String(day.status))) {
      return Response.json(
        { error: "This day is already publishing or posted.", code: "DUPLICATE" },
        { status: 409 }
      );
    }

    let campaign: Record<string, unknown> | null = null;
    try {
      campaign = await base44.asServiceRole.entities.Campaign.get(day.campaign_id);
    } catch {
      campaign = null;
    }

    if (!recordOwnedByUser(campaign, user) && !recordOwnedByUser(day, user)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const requestedProviders = Array.isArray(body?.providers)
      ? body.providers.map((p: unknown) => String(p).toLowerCase())
      : mapDayPlatformToProviders(day.platform);
    const providers = requestedProviders.filter((p: string) =>
      ["instagram", "tiktok", "youtube", "x"].includes(p)
    );
    if (!providers.length) {
      return Response.json(
        { error: "No supported platforms to schedule.", code: "VALIDATION" },
        { status: 400 }
      );
    }

    const scheduledAt = resolveScheduledAt(
      day,
      body?.scheduledAt ? String(body.scheduledAt) : null
    );

    const caption = buildDayCaption(day);
    let videoProjectId = day.video_project_id ? String(day.video_project_id) : "";
    let mediaUrl = "";
    let mediaType = "IMAGE";

    if (videoProjectId) {
      try {
        const vp = await base44.asServiceRole.entities.VideoProject.get(videoProjectId);
        if (vp?.rendering_status === "complete" && vp?.render_output_url) {
          mediaUrl = String(vp.render_output_url);
          mediaType = "REELS";
        }
      } catch {
        /* optional */
      }
    }
    if (!mediaUrl && campaign?.release_id) {
      try {
        const release = await base44.asServiceRole.entities.Release.get(String(campaign.release_id));
        if (release?.artwork_url) mediaUrl = String(release.artwork_url);
      } catch {
        /* optional */
      }
    }
    if (!mediaUrl && campaign?.song_id) {
      try {
        const song = await base44.asServiceRole.entities.Song.get(String(campaign.song_id));
        if (song?.artwork_url) mediaUrl = String(song.artwork_url);
      } catch {
        /* optional */
      }
    }

    const existing =
      (await base44.asServiceRole.entities.SocialPost.filter(
        { campaign_day_id: campaignDayId, user_id: user.id },
        "-created_date",
        30
      )) || [];

    const created: Record<string, unknown>[] = [];
    const skipped: Array<{ provider: string; reason: string }> = [];

    const campaignArtistId = campaign?.artist_id ? String(campaign.artist_id) : "";

    for (const provider of providers) {
      const accounts =
        (await base44.asServiceRole.entities.SocialAccount.filter(
          { user_id: user.id, provider, status: "connected" },
          "-connected_at",
          20
        )) || [];
      const account = pickSocialAccountForArtist(accounts, provider, campaignArtistId);
      if (!account) {
        skipped.push({ provider, reason: "not_connected" });
        continue;
      }

      if ((provider === "tiktok" || provider === "youtube") && mediaType !== "REELS") {
        skipped.push({ provider, reason: "video_required" });
        continue;
      }

      if (provider === "x" && !caption.trim() && !mediaUrl) {
        skipped.push({ provider, reason: "caption_or_media_required" });
        continue;
      }

      const active = existing.find(
        (p: Record<string, unknown>) =>
          String(p.provider) === provider &&
          ["scheduled", "publishing", "published"].includes(String(p.status))
      );
      if (active) {
        if (active.status === "scheduled") {
          const updated = await base44.asServiceRole.entities.SocialPost.update(active.id, {
            caption,
            media_url: mediaUrl || active.media_url,
            media_type: mediaType === "REELS" ? "REELS" : active.media_type || "IMAGE",
            video_project_id: videoProjectId || active.video_project_id || "",
            scheduled_at: scheduledAt,
            social_account_id: account.id,
            error_code: "",
            error_message: "",
          });
          created.push(safeSocialPost({ ...active, ...updated, scheduled_at: scheduledAt }));
        } else {
          skipped.push({ provider, reason: String(active.status) });
        }
        continue;
      }

      const row = await base44.asServiceRole.entities.SocialPost.create({
        user_id: user.id,
        campaign_id: String(day.campaign_id || ""),
        campaign_day_id: campaignDayId,
        release_id: campaign?.release_id ? String(campaign.release_id) : "",
        social_account_id: account.id,
        provider,
        platform: provider,
        content_type: String(day.content_type || day.platform || ""),
        caption,
        media_url: mediaUrl,
        media_type: mediaType,
        video_project_id: videoProjectId,
        status: "scheduled",
        scheduled_at: scheduledAt,
        error_code: "",
        error_message: "",
      });
      created.push(safeSocialPost(row));
    }

    if (!created.length) {
      return Response.json(
        {
          ok: false,
          error:
            "Could not schedule any platforms. Connect Instagram/TikTok/YouTube/X and ensure video is ready for TikTok/YouTube.",
          code: "NOT_CONFIGURED",
          skipped,
        },
        { status: 400 }
      );
    }

    const updatedDay = await base44.asServiceRole.entities.CampaignDay.update(campaignDayId, {
      status: "scheduled",
      scheduled_at: scheduledAt,
      user_id: user.id,
      publish_error: "",
      live_permalink: "",
    });

    const scheduledMs = Date.parse(scheduledAt);
    const dueNow = !Number.isNaN(scheduledMs) && scheduledMs <= Date.now();
    const dueWithinFiveMin =
      !Number.isNaN(scheduledMs) && scheduledMs - Date.now() <= 5 * 60 * 1000;

    kickCampaignWorkerAsync({
      skipVideo: true,
      skipStats: true,
      batchLimit: dueNow ? 20 : 12,
    });

    return Response.json({
      ok: true,
      day: updatedDay,
      scheduledAt,
      posts: created,
      skipped,
      queued: true,
      publishDueNow: dueNow,
      workerNudged: true,
      message: dueNow
        ? "Queued for publish — worker notified to post now."
        : dueWithinFiveMin
          ? "Queued — worker will publish within a few minutes of the scheduled time."
          : "Queued — held as scheduled until the planned time (worker runs every few minutes).",
    });
  } catch (error) {
    console.error("[campaignSchedule]", (error as Error)?.message || error);
    return Response.json({ error: "Could not schedule campaign day." }, { status: 500 });
  }
}


serveWithCors(handler);
