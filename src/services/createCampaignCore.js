import { db } from "@/api/base44Client";
import { aiService } from "@/services/aiService";
import { getConnectionStatus } from "@/services/socialService";
import {
  applyBestPlatformMatch,
  buildGeneratedContentFromPlan,
  ensureDayCopyFields,
} from "@/services/campaignPlanEnrichment";
import { linkDraftProjectsToCampaignDays } from "@/services/campaignVideoBridge";
import { normalizePromoStyleChoice } from "@/services/promoStylePresets";
import { addDaysISO, todayISO } from "@/services/format";
import { buildAlbumSongForAI, buildTrackSongForAI, pickAnchorSong } from "@/services/releaseCampaignMode";
import { buildAiSongPayload } from "@/services/aiSongPayload";
import { sortReleaseTracks } from "@/services/releaseTracks";

async function createCampaignPlanFromAI({
  song,
  artist,
  releaseId = "",
  goals = [],
  durationDays = 14,
  startDate = todayISO(),
  promoStylePreset = "viral-pop",
  userId = "",
  campaignNameOverride = "",
  releaseScope = "track",
  release = null,
  allSongs = null,
  onStage,
}) {
  const stage = (msg) => onStage?.(msg);
  const artistName = artist?.name || "Artist";
  const orderedSongs = allSongs ? sortReleaseTracks(allSongs) : [];
  const trackTitles = orderedSongs.map((s) => s.title).filter(Boolean);
  const songForAI = buildAiSongPayload({
    song,
    artistName,
    release,
    allSongs: orderedSongs.length ? orderedSongs : null,
  });

  stage?.("Analyzing song with AI…");
  const generated = await aiService.analyzeSong(songForAI);
  const analysis = {
    ...(generated && typeof generated === "object" ? generated : {}),
    assetProfile: song.analysis?.assetProfile || songForAI.assetProfile || null,
    mediaContext: generated?.mediaContext || null,
    releaseContext: releaseId
      ? {
          releaseId,
          scope: releaseScope,
          releaseTitle: release?.title || "",
          trackTitles,
          focusTrackTitle: song.title || "",
        }
      : null,
  };
  await db.entities.Song.update(song.id, { analysis });

  stage?.("Generating campaign plan…");
  const promoStyle = normalizePromoStyleChoice(promoStylePreset);
  const result = await aiService.generateCampaign({
    song: songForAI,
    analysis,
    goals,
    durationDays,
    startDate,
    promoStyle,
  });

  stage?.("Matching platforms…");
  let connectionStatus = null;
  try {
    connectionStatus = await getConnectionStatus();
  } catch {
    connectionStatus = null;
  }
  const connectedProviders = (connectionStatus?.connections || [])
    .filter((c) => c.status === "connected" && c.canPublish !== false)
    .map((c) => c.provider);

  const enrichedDays = applyBestPlatformMatch(
    ensureDayCopyFields(result.days || [], { song: songForAI, analysis }),
    { analysis, goals, connectedProviders }
  );

  const endDate = addDaysISO(startDate, durationDays - 1);
  const baseName = campaignNameOverride || result.campaignName || `${song.title} Campaign`;
  const campaignPayload = {
    song_id: song.id,
    artist_id: song.artist_id,
    name: baseName,
    status: startDate <= todayISO() ? "active" : "scheduled",
    duration_days: durationDays,
    goals,
    start_date: startDate,
    end_date: endDate,
    summary: result.summary,
    is_demo: false,
  };
  if (releaseId) campaignPayload.release_id = releaseId;

  const campaign = await db.entities.Campaign.create(campaignPayload);
  const days = enrichedDays.map((d) => ({
    campaign_id: campaign.id,
    day_number: d.dayNumber,
    date: d.date,
    platform: d.platform,
    content_type: d.contentType,
    objective: d.objective,
    video_concept: d.videoConcept,
    hook: d.hook,
    video_template: d.videoTemplate,
    caption: d.caption,
    hashtags: d.hashtags,
    cta: d.cta,
    posting_time: d.postingTime,
    status: "planned",
    user_id: userId,
  }));

  let dayProjects = [];
  if (days.length) {
    const createdDays = await db.entities.CampaignDay.bulkCreate(days);
    stage?.("Creating video drafts…");
    dayProjects = await linkDraftProjectsToCampaignDays(db, createdDays, enrichedDays, {
      campaignId: campaign.id,
      songId: song.id,
      song: { ...song, analysis },
      artistName,
      userId,
      styleDefaults: promoStyle,
      lyrics: song.lyrics || "",
    });

    const contentRows = buildGeneratedContentFromPlan(campaign.id, enrichedDays);
    if (contentRows.length) {
      await db.entities.GeneratedContent.bulkCreate(contentRows);
    }
  }

  return { campaign, song: { ...song, analysis }, dayProjects, enrichedDays };
}

/**
 * One album-wide campaign (single plan for the full release).
 */
export async function generateCampaignForAlbum({
  release,
  songs,
  artist,
  goals = [],
  durationDays = 14,
  startDate = todayISO(),
  promoStylePreset = "viral-pop",
  userId = "",
  onStage,
}) {
  const anchor = pickAnchorSong(release, songs);
  if (!anchor) {
    throw new Error("Add at least one track before generating an album campaign.");
  }
  const artistName = artist?.name || "Artist";
  const songForAI = buildAlbumSongForAI(release, songs, artistName);
  const campaignName = `${release.title || "Album"} Campaign`;

  return createCampaignPlanFromAI({
    song: { ...anchor, ...songForAI, artist_id: anchor.artist_id },
    artist,
    release,
    allSongs: songs,
    releaseId: release.id,
    goals,
    durationDays,
    startDate,
    promoStylePreset,
    userId,
    campaignNameOverride: campaignName,
    releaseScope: "album",
    onStage,
  });
}

/**
 * Create or refresh one song + AI campaign plan (no on-device video render).
 * Used by /create/track and release rollout batch generate.
 */
export async function generateCampaignForSong({
  song,
  artist,
  release = null,
  songs = null,
  releaseId = "",
  goals = [],
  durationDays = 14,
  startDate = todayISO(),
  promoStylePreset = "viral-pop",
  userId = "",
  campaignNameSuffix = "",
  onStage,
}) {
  const artistName = artist?.name || "Artist";
  const songForAI = release
    ? buildTrackSongForAI(release, song, songs || [song], artistName)
    : song;
  const result = await createCampaignPlanFromAI({
    song: { ...song, ...songForAI, artist_id: song.artist_id },
    artist,
    releaseId: releaseId || release?.id || "",
    goals,
    durationDays,
    startDate,
    promoStylePreset,
    userId,
    releaseScope: "track",
    release,
    allSongs: songs,
    onStage,
  });
  if (campaignNameSuffix && result.campaign) {
    const name = `${result.campaign.name} ${campaignNameSuffix}`.trim();
    await db.entities.Campaign.update(result.campaign.id, { name });
    result.campaign = { ...result.campaign, name };
  }
  return result;
}
