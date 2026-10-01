/**
 * Campaign video attach pipeline.
 *
 * Rendering runs entirely in the browser (Remotion + WebCodecs). The backend
 * only accepts a pre-rendered public HTTPS MP4 URL and persists it to
 * PreparedMedia + VideoProject rows.
 */
import { isPublicHttpsUrl } from "./instagramPublishing.ts";
import { saveClientRenderedCampaignVideo } from "./mediaPreparation.ts";

// deno-lint-ignore no-explicit-any
export type Base44Client = any;

export type QueueCampaignVideosResult = {
  ok: boolean;
  campaignId: string;
  created: number;
  linked: number;
  skipped: number;
  projectIds: string[];
  errors: string[];
  preparedMediaId?: string;
  videoUrl?: string;
};

export type RenderProjectResult = {
  ok: boolean;
  projectId: string;
  videoUrl?: string;
  preparedMediaId?: string;
  error?: string;
  code?: string;
};

const WIDTH = 1080;
const HEIGHT = 1920;
const DEFAULT_DURATION = 15;
const MAX_QUEUE_PER_CAMPAIGN = 14;

/**
 * Server-side encode microservices are intentionally disabled.
 * All encoding happens client-side; backend only stores the uploaded MP4 URL.
 */
export function isServerFfmpegDisabled(): boolean {
  return true;
}

/**
 * Attach a client-rendered public MP4 to a campaign:
 * - Saves PreparedMedia (campaign_reel_video)
 * - Creates/updates VideoProject rows as complete
 * - Links CampaignDay.video_project_id
 */
export async function attachClientRenderedVideo(params: {
  base44: Base44Client;
  campaignId: string;
  userId: string;
  videoUrl: string;
}): Promise<QueueCampaignVideosResult> {
  const result: QueueCampaignVideosResult = {
    ok: true,
    campaignId: params.campaignId,
    created: 0,
    linked: 0,
    skipped: 0,
    projectIds: [],
    errors: [],
    videoUrl: params.videoUrl,
  };

  const videoUrl = String(params.videoUrl || "").trim();
  if (!videoUrl || !isPublicHttpsUrl(videoUrl)) {
    result.ok = false;
    result.errors.push("invalid_video_url");
    return result;
  }

  try {
    const campaign = await params.base44.asServiceRole.entities.Campaign.get(params.campaignId);
    if (!campaign) {
      result.ok = false;
      result.errors.push("campaign_not_found");
      return result;
    }

    const song = campaign.song_id
      ? await params.base44.asServiceRole.entities.Song.get(campaign.song_id).catch(() => null)
      : null;
    const artist = campaign.artist_id
      ? await params.base44.asServiceRole.entities.Artist.get(campaign.artist_id).catch(() => null)
      : null;

    let artworkUrl = String(song?.artwork_url || "");
    if (!artworkUrl && campaign.release_id) {
      const release = await params.base44.asServiceRole.entities.Release.get(
        campaign.release_id
      ).catch(() => null);
      artworkUrl = String(release?.artwork_url || "");
    }
    const audioUrl = String(song?.audio_url || "");

    const prepared = await saveClientRenderedCampaignVideo({
      base44: params.base44,
      userId: params.userId,
      videoUrl,
      sourceUrl: artworkUrl || videoUrl,
      width: WIDTH,
      height: HEIGHT,
    });
    result.preparedMediaId = prepared.id;

    const ownerUserId = String(
      params.userId || campaign.created_by_id || ""
    ).trim();
    if (!ownerUserId || ownerUserId.startsWith("service_")) {
      result.ok = false;
      result.errors.push("invalid_owner_user_id");
      return result;
    }

    const days =
      (await params.base44.asServiceRole.entities.CampaignDay.filter(
        { campaign_id: params.campaignId },
        "day_number",
        60
      )) || [];

    const limited = days.slice(0, MAX_QUEUE_PER_CAMPAIGN);

    // Prefer a single campaign-level VideoProject (client-created or existing) so Videos tab shows it.
    const existingProjects =
      (await params.base44.asServiceRole.entities.VideoProject.filter(
        { campaign_id: params.campaignId },
        "-created_date",
        40
      ).catch(() => [])) || [];

    let project =
      existingProjects.find(
        (p: Record<string, unknown>) =>
          p.render_output_url && String(p.render_output_url) === videoUrl
      ) ||
      existingProjects.find(
        (p: Record<string, unknown>) => String(p.user_id || "") === ownerUserId
      ) ||
      existingProjects[0] ||
      null;

    if (project?.id) {
      await params.base44.asServiceRole.entities.VideoProject.update(project.id, {
        rendering_status: "complete",
        render_output_url: videoUrl,
        status: "ready",
        artwork_url: artworkUrl || undefined,
        audio_url: audioUrl || undefined,
        user_id: ownerUserId,
      });
      project = await params.base44.asServiceRole.entities.VideoProject.get(project.id);
      result.skipped += 1;
    } else {
      project = await params.base44.asServiceRole.entities.VideoProject.create({
        campaign_id: params.campaignId,
        song_id: String(song?.id || campaign.song_id || ""),
        template: String(limited[0]?.video_template || "CINEMATIC"),
        title: String(song?.title || campaign.name || "Promo"),
        artist_name: String(artist?.name || ""),
        text: String(limited[0]?.hook || limited[0]?.caption || "").slice(0, 120),
        artwork_url: artworkUrl,
        audio_url: audioUrl,
        lyrics: String(song?.lyrics || "").slice(0, 2000),
        text_style: "bold",
        animation_style: "zoom-pan",
        waveform: false,
        duration: Math.min(30, Math.max(8, Number(song?.audio_duration) || DEFAULT_DURATION)),
        aspect_ratio: "9:16",
        resolution: `${WIDTH}x${HEIGHT}`,
        output_format: "mp4",
        rendering_status: "complete",
        render_output_url: videoUrl,
        status: "ready",
        is_demo: false,
        user_id: ownerUserId,
      });
      // Service-role create can stamp service identity onto user_id — force owner.
      await params.base44.asServiceRole.entities.VideoProject.update(project.id, {
        user_id: ownerUserId,
      });
      project = await params.base44.asServiceRole.entities.VideoProject.get(project.id);
      result.created += 1;
    }

    const projectId = String(project.id);
    result.projectIds.push(projectId);

    for (const day of limited) {
      try {
        if (String(day.video_project_id || "") !== projectId) {
          await params.base44.asServiceRole.entities.CampaignDay.update(day.id, {
            video_project_id: projectId,
          });
        }
        result.linked += 1;
      } catch (err) {
        result.errors.push(`day:${day.id}:${(err as Error)?.message || err}`);
      }
    }

    // Ensure any other auto-created service-owned clones for this campaign are reassigned
    // so they remain visible under RLS (or leave them linked to the same owner).
    for (const other of existingProjects) {
      if (String(other.id) === projectId) continue;
      if (String(other.user_id || "").startsWith("service_") || !other.user_id) {
        try {
          await params.base44.asServiceRole.entities.VideoProject.update(other.id, {
            user_id: ownerUserId,
            render_output_url: other.render_output_url || videoUrl,
            rendering_status: "complete",
            status: "ready",
          });
        } catch {
          /* best-effort */
        }
      }
    }

    // Attach URL onto draft/scheduled SocialPosts for this campaign if any.
    try {
      for (const pid of result.projectIds) {
        const posts =
          (await params.base44.asServiceRole.entities.SocialPost.filter(
            { video_project_id: pid },
            "-created_date",
            20
          )) || [];
        for (const post of posts) {
          if (["draft", "scheduled", "failed"].includes(String(post.status))) {
            await params.base44.asServiceRole.entities.SocialPost.update(post.id, {
              media_url: videoUrl,
              media_type: "REELS",
              prepared_media_id: prepared.id || post.prepared_media_id || "",
              prepared_media_url: videoUrl,
            });
          }
        }
      }
    } catch (err) {
      console.warn("[videoRender] social post attach", (err as Error)?.message || err);
    }

    if (!result.projectIds.length && result.errors.length) {
      result.ok = false;
    }
    return result;
  } catch (err) {
    result.ok = false;
    result.errors.push(String((err as Error)?.message || err));
    return result;
  }
}

/**
 * @deprecated Server queue no longer renders. Prefer attachClientRenderedVideo.
 * Kept as a no-op-friendly stub so older callers do not crash.
 */
export async function queueCampaignVideos(params: {
  base44: Base44Client;
  campaignId: string;
  userId: string;
}): Promise<QueueCampaignVideosResult> {
  return {
    ok: false,
    campaignId: params.campaignId,
    created: 0,
    linked: 0,
    skipped: 0,
    projectIds: [],
    errors: ["CLIENT_RENDER_REQUIRED"],
  };
}

/**
 * Server-side encode is disabled. Existing complete projects are returned as-is;
 * queued projects are marked failed with CLIENT_RENDER_REQUIRED.
 */
export async function renderVideoProject(params: {
  base44: Base44Client;
  projectId: string;
  userId?: string;
}): Promise<RenderProjectResult> {
  const projectId = String(params.projectId);
  try {
    const project = await params.base44.asServiceRole.entities.VideoProject.get(projectId);
    if (!project) {
      return { ok: false, projectId, code: "NOT_FOUND", error: "VideoProject not found" };
    }

    if (project.rendering_status === "complete" && project.render_output_url) {
      return {
        ok: true,
        projectId,
        videoUrl: String(project.render_output_url),
      };
    }

    await params.base44.asServiceRole.entities.VideoProject.update(projectId, {
      rendering_status: "failed",
    });

    return {
      ok: false,
      projectId,
      code: "CLIENT_RENDER_REQUIRED",
      error:
        "Server encode is disabled. Render the promo video in the browser and upload the MP4 URL.",
    };
  } catch (err) {
    return {
      ok: false,
      projectId,
      code: "UNEXPECTED",
      error: String((err as Error)?.message || err),
    };
  }
}

/**
 * Cron drain: no longer runs server encodes.
 * Completes nothing; clears stale "rendering" locks to failed.
 */
export async function processQueuedVideoRenders(params: {
  base44: Base44Client;
  limit?: number;
}): Promise<{
  attempted: number;
  completed: number;
  failed: number;
  results: RenderProjectResult[];
  note?: string;
}> {
  const limit = Math.min(6, Math.max(1, params.limit || 3));
  const stuck =
    (await params.base44.asServiceRole.entities.VideoProject.filter(
      { rendering_status: "rendering" },
      "created_date",
      limit
    ).catch(() => [])) || [];

  const results: RenderProjectResult[] = [];
  let failedCount = 0;

  for (const project of stuck) {
    const r = await renderVideoProject({
      base44: params.base44,
      projectId: String(project.id),
    });
    results.push(r);
    if (!r.ok) failedCount += 1;
  }

  return {
    attempted: stuck.length,
    completed: 0,
    failed: failedCount,
    results,
    note: "Server encode disabled; client-rendered MP4 URLs only.",
  };
}
