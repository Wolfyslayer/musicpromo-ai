import { getTemplate } from "@/services/videoTemplates";
import {
  buildLyricCues,
  normalizeArtworkMotion,
  normalizeEditorLook,
  normalizeParticleEffect,
  normalizeVisualStyle,
} from "@/remotion/styles";
import { normalizePromoStyleChoice } from "@/services/promoStylePresets";

const TEMPLATES = new Set(["HOOK", "LYRICS", "CINEMATIC", "WAVEFORM", "RELEASE", "MINIMAL"]);

export function normalizeCampaignTemplate(value, fallback = "LYRICS") {
  const t = String(value || fallback).toUpperCase().trim();
  return TEMPLATES.has(t) ? t : fallback;
}

/** Merge AI day fields with user promo style defaults. */
export function resolveDayVideoLook(aiDay, styleDefaults) {
  const base = normalizePromoStyleChoice(styleDefaults?.presetId || "viral-pop", styleDefaults || {});
  return {
    visualStyle: normalizeVisualStyle(aiDay?.visualStyle || aiDay?.visual_style || base.visualStyle),
    particleEffect: normalizeParticleEffect(aiDay?.particleEffect || aiDay?.particle_effect || base.particleEffect),
    template: normalizeCampaignTemplate(
      aiDay?.videoTemplate || aiDay?.video_template,
      base.defaultTemplate
    ),
    promoDurationSec: Number(aiDay?.promoDurationSec || aiDay?.promo_duration_sec) === 30 ? 30 : 15,
  };
}

export function promoDurationForTemplate(templateId, lookDuration) {
  const tpl = getTemplate(templateId);
  if (lookDuration === 30) return 30;
  return Math.min(30, Math.max(8, tpl.defaultDuration || 15));
}

export function hookTextForDay(aiDay, song, assetProfile) {
  return (
    String(aiDay?.hook || "").trim() ||
    String(aiDay?.onScreenText || aiDay?.on_screen_text || "").trim() ||
    assetProfile?.hooks?.[0] ||
    String(aiDay?.caption || "").split(/[.!?]/)[0]?.trim() ||
    song?.description ||
    ""
  ).slice(0, 120);
}

export function buildDraftVideoProject({
  campaignId,
  songId,
  song,
  artistName,
  aiDay,
  dayNumber,
  campaignDayId,
  userId,
  styleDefaults,
  lyrics,
}) {
  const look = resolveDayVideoLook(aiDay, styleDefaults);
  const duration = promoDurationForTemplate(look.template, look.promoDurationSec);
  const videoType = look.template === "LYRICS" ? "lyrics" : "promo";
  const text = hookTextForDay(aiDay, song, song?.analysis?.assetProfile);
  const lyricCues = buildLyricCues(lyrics || song?.lyrics || "", duration, []);
  const assetEnergy = song?.analysis?.assetProfile?.energy;
  const artworkMotion = normalizeArtworkMotion(
    assetEnergy === "fast" ? "hype" : assetEnergy === "slow" ? "cinematic" : "standard"
  );

  return {
    campaign_id: campaignId,
    song_id: songId,
    campaign_day_id: campaignDayId || "",
    template: look.template,
    title: song?.title || "Untitled",
    artist_name: artistName || "",
    text,
    outro_cta: String(aiDay?.cta || "Listen now").slice(0, 80),
    artwork_url: song?.artwork_url || "",
    audio_url: song?.audio_url || "",
    lyrics: String(lyrics || song?.lyrics || "").slice(0, 8000),
    visual_style: look.visualStyle,
    particle_effect: look.particleEffect,
    editor_look: normalizeEditorLook(null),
    lyric_cues: lyricCues,
    duration,
    video_type: videoType,
    aspect_ratio: "9:16",
    output_format: "mp4",
    rendering_status: "draft",
    status: "draft",
    is_demo: false,
    user_id: userId || "",
    artwork_motion: artworkMotion,
    animation_settings: {
      videoType,
      outroCta: String(aiDay?.cta || "Listen now").slice(0, 80),
      dayNumber,
      videoConcept: aiDay?.videoConcept || aiDay?.video_concept || "",
    },
  };
}

export async function linkDraftProjectsToCampaignDays(db, createdDays, aiDays, ctx) {
  const projects = [];
  for (let i = 0; i < createdDays.length; i++) {
    const row = createdDays[i];
    const aiDay = aiDays[i] || {};
    const draft = buildDraftVideoProject({
      ...ctx,
      aiDay,
      dayNumber: row.day_number ?? aiDay.dayNumber ?? i + 1,
      campaignDayId: row.id,
    });
    const vp = await db.entities.VideoProject.create(draft);
    await db.entities.CampaignDay.update(row.id, { video_project_id: vp.id, status: "ready" });
    projects.push({ dayId: row.id, project: vp, aiDay });
  }
  return projects;
}

/** On-device Remotion encode for a saved VideoProject row; updates project + optional campaign link. */
export async function renderPromoForProject({
  db,
  project,
  songTitle,
  artistName,
  artworkUrl,
  artworkFile,
  audioUri,
  audioSignedUrl,
  audioFile,
  audioDuration,
  lyrics,
  onProgress,
  linkCampaignId,
  triggerCampaignAutoVideo,
}) {
  const { resolvePlayableAudioUrl } = await import("@/services/videoService");
  const { renderPromoRemotion } = await import("@/remotion/renderPromoRemotion");

  let playableAudio = audioSignedUrl || "";
  if (!playableAudio) {
    playableAudio = await resolvePlayableAudioUrl(audioUri);
  }
  if (!playableAudio && audioFile) {
    const uploadedAudio = await db.integrations.Core.UploadPublicFile({ file: audioFile });
    playableAudio = uploadedAudio?.file_url || uploadedAudio?.url || "";
  }
  if (!playableAudio) throw new Error("Could not resolve a playable audio URL for rendering.");
  if (!artworkUrl) throw new Error("Artwork URL is required for Remotion render.");

  const duration = Math.min(60, Math.max(8, Number(project.duration) || 15));
  const lyricCues = buildLyricCues(lyrics || project.lyrics || "", duration, project.lyric_cues || []);
  const videoType = project.video_type || (project.template === "LYRICS" ? "lyrics" : "promo");

  const rendered = await renderPromoRemotion({
    artworkUrl,
    artworkFile,
    audioUrl: playableAudio,
    audioFile,
    duration,
    look: project.editor_look,
    title: project.title || songTitle || "",
    artistName: project.artist_name || artistName || "",
    text: project.text || "",
    lyrics: lyrics || project.lyrics || "",
    visualStyle: project.visual_style,
    particleEffect: project.particle_effect,
    lyricCues,
    videoType,
    outroCta: project.outro_cta || project.animation_settings?.outroCta || "",
    onProgress,
  });

  onProgress?.({ progress: 96, message: "Uploading MP4…" });
  const uploaded = await db.integrations.Core.UploadPublicFile({ file: rendered.file });
  const renderedVideoUrl = uploaded?.file_url || uploaded?.url || "";
  if (!renderedVideoUrl) throw new Error("Upload succeeded but no public video URL was returned.");

  const patch = {
    rendering_status: "complete",
    render_output_url: renderedVideoUrl,
    status: "ready",
    output_format: "mp4",
    aspect_ratio: "9:16",
    resolution: `${rendered.width}x${rendered.height}`,
    duration: rendered.duration,
    lyric_cues: rendered.lyricCues || lyricCues,
    visual_style: rendered.visualStyle,
    particle_effect: rendered.particleEffect,
  };
  await db.entities.VideoProject.update(project.id, patch);

  if (linkCampaignId && triggerCampaignAutoVideo) {
    await triggerCampaignAutoVideo({ campaignId: linkCampaignId, videoUrl: renderedVideoUrl });
  }

  return { ...project, ...patch, url: renderedVideoUrl };
}
