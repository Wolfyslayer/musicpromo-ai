import { db } from "@/api/base44Client";
import { resolveBestAudioStartOffset } from "@/services/audioHighlight";
import { buildDraftVideoProject } from "@/services/campaignVideoBridge";
import { renderCampaignDayProjects } from "@/services/campaignVideoRenderBatch";
import { isVideoProjectReady } from "@/lib/campaignVideoReadiness";
import { normalizePromoStyleChoice } from "@/services/promoStylePresets";
import { triggerCampaignAutoVideo } from "@/services/socialService";

function dayToAiDay(day) {
  if (!day) return {};
  return {
    dayNumber: day.day_number,
    hook: day.hook,
    caption: day.caption,
    cta: day.cta,
    videoConcept: day.video_concept,
    videoTemplate: day.video_template,
    visualStyle: day.visual_style,
    particleEffect: day.particle_effect,
    promoDurationSec: day.promo_duration_sec,
  };
}

/** Create missing VideoProject rows for plan days (legacy campaigns). */
export async function ensureCampaignVideoDrafts({
  campaign,
  days,
  song,
  artistName = "",
  release = null,
  userId = "",
}) {
  const artworkUrl = song?.artwork_url || release?.artwork_url || "";
  const styleDefaults = normalizePromoStyleChoice("viral-pop");
  const out = [];

  for (const day of days || []) {
    if (day.video_project_id) continue;
    const aiDay = dayToAiDay(day);
    const draft = buildDraftVideoProject({
      campaignId: campaign.id,
      songId: song?.id || campaign.song_id,
      song: { ...song, artwork_url: artworkUrl, analysis: song?.analysis },
      artistName,
      aiDay,
      dayNumber: day.day_number,
      campaignDayId: day.id,
      userId,
      styleDefaults,
      lyrics: song?.lyrics || "",
    });
    const vp = await db.entities.VideoProject.create(draft);
    await db.entities.CampaignDay.update(day.id, {
      video_project_id: vp.id,
      status: day.status === "planned" ? "ready" : day.status,
    });
    out.push({ dayId: day.id, project: vp, aiDay });
  }
  return out;
}

/** Apply latest hook-based clip start to draft projects before encode. */
export async function refreshProjectHighlightOffsets({ song, dayProjects }) {
  for (const row of dayProjects || []) {
    const project = row?.project;
    if (!project?.id || isVideoProjectReady(project)) continue;
    const offset = resolveBestAudioStartOffset({
      song,
      analysis: song?.analysis,
      aiDay: row.aiDay || dayToAiDay(row.day),
      audioDurationSec: song?.duration || song?.audio_duration || project.audio_duration,
      clipDurationSec: project.duration || 15,
    });
    if (Number(project.audioStartTimeOffset) === offset) continue;
    await db.entities.VideoProject.update(project.id, {
      audioStartTimeOffset: offset,
      animation_settings: {
        ...(project.animation_settings || {}),
        highlightOffsetSec: offset,
      },
    });
    row.project = { ...project, audioStartTimeOffset: offset };
  }
}

function buildDayProjectRows(days, videos) {
  const byId = new Map((videos || []).map((v) => [v.id, v]));
  const byCampaignDayId = new Map(
    (videos || [])
      .filter((v) => v.campaign_day_id)
      .map((v) => [v.campaign_day_id, v])
  );
  return (days || [])
    .map((day) => {
      const project =
        (day.video_project_id && byId.get(day.video_project_id)) ||
        byCampaignDayId.get(day.id) ||
        null;
      if (!project) return null;
      return {
        dayId: day.id,
        day,
        project,
        aiDay: dayToAiDay(day),
      };
    })
    .filter(Boolean);
}

/**
 * One-click: backfill drafts if needed, refresh hook clip offsets, encode all pending MP4s.
 */
export async function oneClickGenerateCampaignVideos({
  campaign,
  days,
  videos,
  song,
  artistName = "",
  release = null,
  userId = "",
  includeReady = false,
  onProgress,
  onStage,
}) {
  if (!campaign?.id) throw new Error("Campaign not found.");
  if (!days?.length) throw new Error("Add campaign plan days first.");

  const songMedia = {
    ...song,
    artwork_url: song?.artwork_url || release?.artwork_url || "",
    audio_url: song?.audio_url || "",
  };
  if (!songMedia.artwork_url) {
    throw new Error("Add artwork on the release or song before generating videos.");
  }
  if (!songMedia.audio_url) {
    throw new Error("Upload track audio before generating videos.");
  }

  onStage?.("Preparing video drafts…");
  await ensureCampaignVideoDrafts({
    campaign,
    days,
    song: songMedia,
    artistName,
    release,
    userId,
  });

  const freshVideos = await db.entities.VideoProject.filter(
    { campaign_id: campaign.id },
    "-created_date",
    100
  );
  let rows = buildDayProjectRows(days, freshVideos?.length ? freshVideos : videos);
  if (!rows.length) {
    throw new Error("Could not link plan days to video projects.");
  }

  if (!includeReady) {
    rows = rows.filter((r) => !isVideoProjectReady(r.project));
  }
  if (!rows.length) {
    return { rendered: 0, skipped: true, message: "All plan videos are already exported." };
  }

  onStage?.("Setting best hook clip for each day…");
  await refreshProjectHighlightOffsets({ song: songMedia, dayProjects: rows });

  onStage?.("Encoding promo videos…");
  const result = await renderCampaignDayProjects({
    db,
    dayProjects: rows,
    song: songMedia,
    artistName,
    lyrics: songMedia.lyrics || "",
    renderMode: "all",
    onProgress,
    onStage,
    triggerCampaignAutoVideo,
  });

  return { ...result, skipped: false };
}

export function countVideosNeedingExport(days, videos) {
  const byId = new Map((videos || []).map((v) => [v.id, v]));
  const byCampaignDayId = new Map(
    (videos || [])
      .filter((v) => v.campaign_day_id)
      .map((v) => [v.campaign_day_id, v])
  );
  let missing = 0;
  let draft = 0;
  for (const day of days || []) {
    const v =
      (day.video_project_id && byId.get(day.video_project_id)) ||
      byCampaignDayId.get(day.id) ||
      null;
    if (!v) {
      missing += 1;
      continue;
    }
    if (!isVideoProjectReady(v)) draft += 1;
  }
  return { missing, draft, total: missing + draft };
}
