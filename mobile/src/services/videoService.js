/**
 * Video service. Promo videos are rendered on the device for free: the web app's Remotion/WebCodecs
 * pipeline runs inside the hidden WebView of <RenderHost /> (see lib/renderBridge.ts). Local assets are
 * uploaded first so the web renderer only needs public HTTPS URLs.
 */

import { getTemplate, VIDEO_RESOLUTION } from "./videoTemplates";
import { getRenderBridge } from "@/lib/renderBridge";
import { resolveAssetUrl, uploadPromoAsset } from "@/services/supabaseStore";
import { saveVideoProject } from "@/services/studioRecords";
import {
  buildLyricCues,
  normalizeEditorLook,
  normalizeParticleEffect,
  normalizeVideoType,
  normalizeVisualStyle,
  resolveStudioDuration,
} from "@/remotion/styles";


const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isPickedFile(file) {
  return Boolean(file) && typeof file === "object" && typeof file.uri === "string" && file.uri.length > 0;
}

function isLocalUri(value) {
  return /^(file|content|ph|assets-library|blob):/i.test(String(value || ""));
}

function isHttps(value) {
  return /^https:\/\//i.test(String(value || ""));
}

/** Resolve a stored file reference into a fetchable audio URL. */
export async function resolvePlayableAudioUrl(audioRef) {
  const raw = String(audioRef || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || isLocalUri(raw)) return raw;
  try {
    return (await resolveAssetUrl(raw)) || "";
  } catch (err) {
    console.warn("[videoService] audio url", err?.message || err);
    return "";
  }
}

/** Resolve artwork to a public HTTPS URL, uploading a locally picked image first. */
export async function resolvePublicArtworkUrl(artworkUrl, artworkFile) {
  if (isPickedFile(artworkFile)) {
    const uploaded = await uploadPromoAsset(artworkFile, "artwork");
    return uploaded?.publicUrl || "";
  }
  const raw = String(artworkUrl || "").trim();
  if (!raw) return "";
  if (isLocalUri(raw)) {
    const uploaded = await uploadPromoAsset({ uri: raw, name: `artwork-${Date.now()}.jpg`, type: "image/jpeg" }, "artwork");
    return uploaded?.publicUrl || "";
  }
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return (await resolveAssetUrl(raw)) || "";
  } catch {
    return raw;
  }
}

async function resolvePublicAudioUrl(project, options) {
  if (isPickedFile(options.audioFile)) {
    const uploaded = await uploadPromoAsset(options.audioFile, "audio");
    return uploaded?.publicUrl || "";
  }
  const preferred = String(options.audioUrl || "").trim();
  if (isHttps(preferred)) return preferred;
  const raw = String(project?.audio_url || "").trim();
  if (isLocalUri(raw)) {
    const uploaded = await uploadPromoAsset({ uri: raw, name: `audio-${Date.now()}.mp3`, type: "audio/mpeg" }, "audio");
    return uploaded?.publicUrl || "";
  }
  return resolvePlayableAudioUrl(raw);
}

function failure(project, message) {
  return { status: "failed", isMock: false, downloadUrl: null, message, project };
}

function errorText(err, fallback) {
  const message = String(err?.message || fallback);
  if (/webcodecs|encode support|not supported|cannot be encoded|unsupported/i.test(message)) {
    return "This phone's built-in browser cannot encode video. Render this project from the web app instead; it will appear here afterwards.";
  }
  return message;
}

export const videoService = {
  isMock: false,

  async renderVideo(project) {
    await wait(200);
    const template = getTemplate(project.template);
    const live =
      project?.rendering_status === "complete" && isHttps(project?.render_output_url);
    return {
      status: live ? "ready" : project?.rendering_status || "ready",
      isMock: !live,
      resolution: VIDEO_RESOLUTION,
      duration: project.duration || template.defaultDuration,
      template,
      previewUrl: live ? project.render_output_url : null,
    };
  },

  /**
   * Upload local assets, save the project, then render the MP4 on the device through the web renderer.
   * Resolves with status `ready` (and `downloadUrl`) or `failed`.
   * @param {any} project
   * @param {{ onProgress?: (info: { phase: string, progress: number, message: string }) => void, audioUrl?: string, audioFile?: { uri: string } | null, artworkFile?: { uri: string } | null }} [options]
   * @returns {Promise<{ status: string, isMock: boolean, downloadUrl: string | null, message: string, project: any }>}
   */
  async exportVideo(project, options = {}) {
    const onProgress = options.onProgress;

    if (!project?.artwork_url && !isPickedFile(options.artworkFile)) {
      return failure(project, "Artwork is required to render a promo video.");
    }

    try {
      onProgress?.({ phase: "assets", progress: 2, message: "Preparing artwork and audio…" });

      const audioUrl = await resolvePublicAudioUrl(project, options);
      if (!audioUrl) {
        return failure(project, "Audio is required to render a promo video. Re-upload the song on the campaign.");
      }
      const artworkUrl = await resolvePublicArtworkUrl(project?.artwork_url, options.artworkFile);
      if (!artworkUrl) {
        return failure(project, "Artwork is required to render a promo video.");
      }
      if (!isHttps(audioUrl) || !isHttps(artworkUrl)) {
        return failure(project, "Artwork and audio must be uploaded before they can be rendered.");
      }

      const visualStyle = normalizeVisualStyle(project?.visual_style);
      const particleEffect = normalizeParticleEffect(project?.particle_effect);
      const videoType = normalizeVideoType(project?.video_type || project?.animation_settings?.videoType) || "promo";
      const duration = resolveStudioDuration(videoType, project?.duration, project?.audio_duration);
      const look = normalizeEditorLook(project?.editor_look);
      const lyricCues = buildLyricCues(project?.lyrics, duration, project?.lyric_cues);

      onProgress?.({ phase: "assets", progress: 4, message: "Saving project…" });
      const saved = await saveVideoProject({
        ...project,
        artwork_url: artworkUrl,
        audio_url: project?.audio_url && !isLocalUri(project.audio_url) ? project.audio_url : audioUrl,
        duration,
        editor_look: look,
        visual_style: visualStyle,
        particle_effect: particleEffect,
        lyric_cues: lyricCues,
        template: project?.template || "LYRICS",
      });
      const projectId = saved?.id || project?.id;
      if (!projectId) throw new Error("Could not save the video project.");

      const bridge = getRenderBridge();
      const result = await bridge.render(
        { ...saved, id: projectId, artwork_url: artworkUrl },
        { audioUrl, onProgress }
      );

      if (result?.status !== "ready" || !result?.downloadUrl) {
        return failure({ ...saved, id: projectId }, errorText({ message: result?.message }, "Video render failed."));
      }
      return {
        status: "ready",
        isMock: false,
        downloadUrl: result.downloadUrl,
        message: result.message || "Promo video rendered on your device.",
        project: { ...saved, ...(result.project || {}), id: projectId },
      };
    } catch (err) {
      return failure(project, errorText(err, "Could not render the video."));
    }
  },
};

export default videoService;
