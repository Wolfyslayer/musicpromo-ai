import { renderPromoForProject } from "@/services/campaignVideoBridge";
import { resolveRenderCount } from "@/services/campaignPlanEnrichment";
import { resolvePlayableAudioUrl } from "@/services/videoService";
import { scheduleCampaignDay } from "@/services/socialService";

/**
 * Encode Remotion promo MP4s for campaign plan days (browser WebCodecs).
 */
export async function renderCampaignDayProjects({
  db,
  dayProjects,
  song,
  artistName = "",
  lyrics = "",
  artworkFile = null,
  audioFile = null,
  renderMode = "all",
  onProgress,
  onStage,
  autoSchedule = false,
  triggerCampaignAutoVideo = null,
}) {
  const count = resolveRenderCount(renderMode, dayProjects?.length || 0);
  if (!count) return { rendered: 0, scheduled: 0, scheduleSkipped: 0 };

  if (!song?.artwork_url) {
    throw new Error("Add release artwork before encoding promo videos.");
  }

  let audioSignedUrl = "";
  if (song?.audio_url) {
    audioSignedUrl = await resolvePlayableAudioUrl(song.audio_url);
  }
  if (!audioSignedUrl && !song?.audio_url) {
    throw new Error("Upload track audio before encoding promo videos.");
  }

  let rendered = 0;
  let scheduled = 0;
  let scheduleSkipped = 0;

  for (let i = 0; i < count; i++) {
    const row = dayProjects[i];
    const project = row?.project;
    const dayId = row?.dayId;
    const aiDay = row?.aiDay;
    if (!project?.id) continue;

    const dayLabel = aiDay?.dayNumber || i + 1;
    onStage?.(`Rendering Day ${dayLabel} promo…`);
    onProgress?.({ progress: 0, message: `Day ${dayLabel} — starting…` });

    await renderPromoForProject({
      db,
      project,
      songTitle: song?.title || project.title,
      artistName: artistName || project.artist_name || "",
      artworkUrl: song.artwork_url,
      artworkFile,
      audioUri: song.audio_url,
      audioSignedUrl,
      audioFile,
      lyrics: lyrics || song?.lyrics || project.lyrics || "",
      linkCampaignId: i === 0 ? project.campaign_id : "",
      triggerCampaignAutoVideo: i === 0 ? triggerCampaignAutoVideo : null,
      onProgress: (info) => {
        const slice = count > 1 ? i / count + (info.progress || 0) / 100 / count : (info.progress || 0) / 100;
        onProgress?.({
          progress: Math.round(slice * 100),
          message: info.message || `Day ${dayLabel}…`,
        });
      },
    });
    rendered += 1;

    if (autoSchedule && dayId) {
      onStage?.(`Scheduling Day ${dayLabel}…`);
      const res = await scheduleCampaignDay({
        campaignDayId: dayId,
        day: {
          platform: row?.aiDay?.platform,
          publish_platforms: row?.aiDay?.publish_platforms,
        },
      });
      if (res?.ok) scheduled += 1;
      else scheduleSkipped += 1;
    }
  }

  onProgress?.({ progress: 100, message: "Done" });
  return { rendered, scheduled, scheduleSkipped };
}
