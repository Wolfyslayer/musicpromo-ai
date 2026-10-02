/**
 * Video service: queues server-side promo renders and polls their status.
 * The phone never renders video; `requestVideoRender` hands the job to the render worker.
 */

import { getTemplate, VIDEO_RESOLUTION } from "./videoTemplates";
import { db } from "@/api/base44Client";
import { resolveAssetUrl, uploadPromoAsset } from "@/services/supabaseStore";
import { saveVideoProject, selectVideoProject } from "@/services/studioRecords";
import {
  buildLyricCues,
  normalizeEditorLook,
  normalizeParticleEffect,
  normalizeVideoType,
  normalizeVisualStyle,
  resolveStudioDuration,
} from "@/remotion/styles";

export const RENDER_POLL_INTERVAL_MS = 4000;
export const RENDER_TIMEOUT_MS = 10 * 60 * 1000;

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
  if (/RENDER_WORKER_NOT_CONFIGURED/.test(message)) {
    return "Video rendering is not set up on the server yet. Your project is saved; try again once the render worker is configured.";
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
   * Upload local assets, save the project as `queued` and ask the server to render it.
   * Resolves with status `queued`; use `pollRenderStatus` to wait for the MP4.
   * @param {any} project
   * @param {{ onProgress?: (info: { phase: string, progress: number, message: string }) => void, audioUrl?: string, audioFile?: { uri: string } | null, artworkFile?: { uri: string } | null }} [options]
   * @returns {Promise<{ status: string, isMock: boolean, downloadUrl: string | null, message: string, project: any, jobId?: string | null }>}
   */
  async exportVideo(project, options = {}) {
    const onProgress = options.onProgress;

    if (!project?.artwork_url && !isPickedFile(options.artworkFile)) {
      return failure(project, "Artwork is required to render a promo video.");
    }

    try {
      onProgress?.({ phase: "assets", progress: 3, message: "Preparing artwork and audio…" });

      const audioUrl = await resolvePublicAudioUrl(project, options);
      if (!audioUrl) {
        return failure(project, "Audio is required to render a promo video. Re-upload the song on the campaign.");
      }
      onProgress?.({ phase: "assets", progress: 8, message: "Audio ready" });

      const artworkUrl = await resolvePublicArtworkUrl(project?.artwork_url, options.artworkFile);
      if (!artworkUrl) {
        return failure(project, "Artwork is required to render a promo video.");
      }
      if (!isHttps(audioUrl) || !isHttps(artworkUrl)) {
        return failure(project, "Artwork and audio must be uploaded before the server can render them.");
      }

      const visualStyle = normalizeVisualStyle(project?.visual_style);
      const particleEffect = normalizeParticleEffect(project?.particle_effect);
      const videoType = normalizeVideoType(project?.video_type || project?.animation_settings?.videoType) || "promo";
      const duration = resolveStudioDuration(videoType, project?.duration, project?.audio_duration);
      const look = normalizeEditorLook(project?.editor_look);
      const lyricCues = buildLyricCues(project?.lyrics, duration, project?.lyric_cues);
      const outroCta = project?.outro_cta || project?.animation_settings?.outroCta || "";
      const audioStartTimeOffset = Number(project?.audioStartTimeOffset) || 0;

      onProgress?.({ phase: "queue", progress: 12, message: "Saving project…" });
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
        rendering_status: "queued",
        render_progress: 0,
        render_error: null,
        resolution: "1080x1920",
        output_format: "mp4",
        aspect_ratio: "9:16",
      });
      const projectId = saved?.id || project?.id;
      if (!projectId) throw new Error("Could not save the video project.");

      onProgress?.({ phase: "queue", progress: 15, message: "Sending to the render server…" });
      const response = await db.functions.invoke("requestVideoRender", {
        projectId,
        campaignId: project?.campaign_id || saved?.campaign_id || null,
        artworkUrl,
        audioUrl,
        duration,
        look,
        title: project?.title || "",
        artistName: project?.artist_name || "",
        text: project?.text || "",
        lyrics: project?.lyrics || "",
        visualStyle,
        particleEffect,
        lyricCues,
        audioStartTimeOffset,
        videoType,
        outroCta,
      });
      const data = response?.data ?? response;
      if (data && data.ok === false) {
        return failure({ ...saved, rendering_status: "failed" }, errorText({ message: data.error || data.code }, "Could not queue the render."));
      }

      const queuedProject = { ...saved, id: projectId, rendering_status: "queued", render_progress: 0 };
      return {
        status: "queued",
        isMock: false,
        downloadUrl: null,
        message: "Render queued. This usually takes a few minutes.",
        project: queuedProject,
        jobId: data?.jobId || null,
      };
    } catch (err) {
      return failure(project, errorText(err, "Could not start the video render."));
    }
  },

  pollRenderStatus,
};

/**
 * Poll the project row until the worker reports `complete` or `failed`.
 * Resolves with `{ status: "ready" | "failed" | "timeout" | "aborted", downloadUrl?, message?, project? }`.
 * @param {string} projectId
 * @param {{ onProgress?: (info: { phase: string, progress: number, message: string }) => void, signal?: AbortSignal, intervalMs?: number, timeoutMs?: number }} [options]
 * @returns {Promise<{ status: string, downloadUrl?: string, message?: string, project?: any }>}
 */
export async function pollRenderStatus(
  projectId,
  { onProgress, signal, intervalMs = RENDER_POLL_INTERVAL_MS, timeoutMs = RENDER_TIMEOUT_MS } = {}
) {
  const startedAt = Date.now();
  let lastProject = null;
  let failedReads = 0;

  while (true) {
    if (signal?.aborted) return { status: "aborted", project: lastProject };
    if (Date.now() - startedAt > timeoutMs) {
      return {
        status: "timeout",
        message: "Rendering is taking longer than expected. Check back in a few minutes.",
        project: lastProject,
      };
    }

    try {
      const project = await selectVideoProject(projectId);
      failedReads = 0;
      lastProject = project;
      const state = project?.rendering_status;
      if (state === "complete" && isHttps(project?.render_output_url)) {
        onProgress?.({ phase: "complete", progress: 100, message: "Video ready" });
        return { status: "ready", downloadUrl: project.render_output_url, project };
      }
      if (state === "failed") {
        return {
          status: "failed",
          message: project?.render_error || "The server could not render this video.",
          project,
        };
      }
      const reported = Number(project?.render_progress);
      const progress = Number.isFinite(reported) ? Math.max(15, Math.min(99, reported)) : 15;
      onProgress?.({
        phase: state === "rendering" ? "rendering" : "queued",
        progress,
        message: state === "rendering" ? "Rendering on the server…" : "Waiting for a render slot…",
      });
    } catch (err) {
      failedReads += 1;
      if (failedReads >= 5) {
        return { status: "failed", message: err?.message || "Could not read the render status.", project: lastProject };
      }
    }

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, intervalMs);
      signal?.addEventListener?.(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    });
  }
}

export default videoService;
