import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import { PromoComposition } from "./PromoComposition";
import {
  PROMO_FPS,
  PROMO_HEIGHT,
  PROMO_WIDTH,
  buildLyricCues,
  normalizeEditorLook,
  normalizeParticleEffect,
  normalizeVideoType,
  normalizeVisualStyle,
  resolveStudioDuration,
} from "./styles";
import { waitForPromoFonts } from "./fonts";

/**
 * Render a 9:16 promo MP4 entirely in the browser via WebCodecs.
 */
export async function renderPromoRemotion(params = {}) {
  const onProgress = params.onProgress;
  const videoType = normalizeVideoType(params.videoType || params.video_type);
  const durationSec = resolveStudioDuration(videoType, params.duration, params.audioDuration);
  const look = normalizeEditorLook(params.look || params.editor_look);
  const durationInFrames = Math.round(durationSec * PROMO_FPS);
  const visualStyle = normalizeVisualStyle(params.visualStyle || params.visual_style);
  const particleEffect = normalizeParticleEffect(params.particleEffect || params.particle_effect);
  const lyricCues = buildLyricCues(
    params.lyrics,
    durationSec,
    params.lyricCues || params.lyric_cues
  );

  const artworkUrl = params.artworkUrl || "";
  const audioUrl = params.audioUrl || "";
  if (!artworkUrl) throw new Error("Artwork URL is required for Remotion render.");
  if (!audioUrl) throw new Error("Audio URL is required for Remotion render.");

  onProgress?.({ phase: "check", progress: 2, message: "Checking browser encode support…" });

  const support = await canRenderMediaOnWeb({
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    width: PROMO_WIDTH,
    height: PROMO_HEIGHT,
  });
  if (!support.canRender) {
    const reason =
      support.issues?.map((i) => i.type || i.message || String(i)).join(", ") ||
      "WebCodecs MP4 encode is not available in this browser.";
    throw new Error(
      `This browser cannot render promo videos (${reason}). Use the latest Chrome or Firefox.`
    );
  }

  onProgress?.({ phase: "fonts", progress: 5, message: "Loading typography…" });
  await waitForPromoFonts();

  onProgress?.({ phase: "render", progress: 8, message: "Rendering frames on your device…" });

  const inputProps = {
    artworkUrl,
    audioUrl,
    title: params.title || "",
    artistName: params.artistName || params.artist_name || "",
    text: params.text || "",
    visualStyle,
    particleEffect,
    lyricCues,
    look,
    audioStartTimeOffset: Math.max(0, Number(params.audioStartTimeOffset) || 0),
    videoType,
    outroCta: params.outroCta || params.outro_cta || "",
  };

  const result = await renderMediaOnWeb({
    composition: {
      component: PromoComposition,
      id: "musicpromo-9x16",
      width: PROMO_WIDTH,
      height: PROMO_HEIGHT,
      fps: PROMO_FPS,
      durationInFrames,
      defaultProps: inputProps,
    },
    inputProps,
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    videoBitrate: "high",
    audioBitrate: "high",
    onProgress: (info) => {
      const pct = Math.round(Math.min(0.94, Math.max(0, info.progress || 0)) * 100);
      const mapped = 8 + Math.round(pct * 0.86);
      onProgress?.({
        phase: "render",
        progress: mapped,
        message: `Encoding frame ${info.encodedFrames || 0}… ${mapped}%`,
      });
    },
  });

  onProgress?.({ phase: "blob", progress: 94, message: "Packaging MP4…" });
  const blob = await result.getBlob();
  const file = new File([blob], `promo-${Date.now()}.mp4`, { type: "video/mp4" });

  return {
    file,
    blob,
    width: PROMO_WIDTH,
    height: PROMO_HEIGHT,
    fps: PROMO_FPS,
    duration: durationSec,
    visualStyle,
    particleEffect,
    lyricCues,
  };
}

export default renderPromoRemotion;
