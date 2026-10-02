/**
 * Video service — client-side Remotion (WebCodecs) render/export.
 */

import { getTemplate, VIDEO_RESOLUTION } from "./videoTemplates";
import { db } from "@/api/base44Client";
import { resolveAssetUrl, uploadPromoAsset } from "@/services/supabaseStore";
import { triggerCampaignAutoVideo } from "@/services/socialService";
import { buildLyricCues, normalizeEditorLook, normalizeParticleEffect, normalizeVideoType, normalizeVisualStyle, resolveStudioDuration } from "@/remotion/styles";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve a private file URI or HTTPS URL into a fetchable audio URL. */
export async function resolvePlayableAudioUrl(audioRef) {
  const raw = String(audioRef || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  try {
    return (await resolveAssetUrl(raw)) || "";
  } catch (err) {
    console.warn("[videoService] signed audio URL", err?.message || err);
    return "";
  }
}

/** Resolve artwork to a fetchable HTTPS URL (upload File when needed). */
export async function resolvePublicArtworkUrl(artworkUrl, artworkFile) {
  if (artworkFile instanceof Blob) {
    const uploaded = await uploadPromoAsset(artworkFile, "artwork");
    return uploaded?.publicUrl || "";
  }
  const raw = String(artworkUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return (await resolveAssetUrl(raw)) || "";
  } catch {
    return raw;
  }
}

export const videoService = {
  isMock: false,

  async renderVideo(project) {
    await wait(200);
    const template = getTemplate(project.template);
    const live =
      project?.rendering_status === "complete" &&
      project?.render_output_url &&
      /^https:\/\//i.test(project.render_output_url);
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
   * Encode promo MP4 in the browser with Remotion, upload, update VideoProject.
   */
  async exportVideo(project, options = {}) {
    const onProgress = options.onProgress;
    const artworkFile = options.artworkFile;
    const audioFile = options.audioFile;

    if (!artworkFile && !project?.artwork_url) {
      return {
        status: "failed",
        isMock: false,
        downloadUrl: null,
        message: "Artwork is required to render a promo video.",
        project,
      };
    }

    try {
      onProgress?.({ phase: "assets", progress: 3, message: "Preparing artwork & audio…" });

      let audioUrl = options.audioUrl || "";
      if (audioFile instanceof Blob) {
        const uploadedAudio = await uploadPromoAsset(audioFile, "audio");
        audioUrl = uploadedAudio?.publicUrl || "";
      } else if (!audioUrl) {
        audioUrl = await resolvePlayableAudioUrl(project?.audio_url);
      }
      if (!audioUrl) {
        return {
          status: "failed",
          isMock: false,
          downloadUrl: null,
          message: "Audio is required to render a promo video. Re-upload the song on the campaign.",
          project,
        };
      }

      const artworkUrl = await resolvePublicArtworkUrl(project?.artwork_url, artworkFile);
      if (!artworkUrl) {
        return {
          status: "failed",
          isMock: false,
          downloadUrl: null,
          message: "Artwork is required to render a promo video.",
          project,
        };
      }

      const visualStyle = normalizeVisualStyle(project?.visual_style);
      const particleEffect = normalizeParticleEffect(project?.particle_effect);
      const videoType = normalizeVideoType(project?.video_type || project?.animation_settings?.videoType);
      const duration = resolveStudioDuration(videoType, project?.duration, project?.audio_duration);
      const editorLook = normalizeEditorLook(project?.editor_look);
      const lyricCues = buildLyricCues(
        project?.lyrics,
        duration,
        project?.lyric_cues
      );

      const { renderPromoRemotion } = await import("@/remotion/renderPromoRemotion");
      const rendered = await renderPromoRemotion({
        artworkUrl,
        artworkFile,
        audioUrl,
        audioFile,
        duration,
        look: editorLook,
        title: project?.title || "",
        artistName: project?.artist_name || "",
        text: project?.text || "",
        lyrics: project?.lyrics || "",
        visualStyle,
        particleEffect,
        lyricCues,
        audioStartTimeOffset: project?.audioStartTimeOffset || 0,
        videoType,
        outroCta: project?.outro_cta || project?.animation_settings?.outroCta || "",
        aiClipUrl: project?.ai_clip_url || "",
        compositingMode: project?.compositing_mode || "artwork",
        aiClipOpacity: project?.ai_clip_opacity ?? 1,
        onProgress,
      });

      onProgress?.({ phase: "uploading", progress: 96, message: "Uploading MP4…" });
      const uploaded = await uploadPromoAsset(rendered.file, "video");
      const videoUrl = uploaded?.publicUrl || "";
      if (!videoUrl) {
        throw new Error("Upload succeeded but no public video URL was returned.");
      }

      const projectPatch = {
        rendering_status: "complete",
        render_output_url: videoUrl,
        status: "ready",
        output_format: "mp4",
        aspect_ratio: "9:16",
        resolution: `${rendered.width}x${rendered.height}`,
        duration: rendered.duration,
        editor_look: editorLook,
        visual_style: rendered.visualStyle,
        particle_effect: rendered.particleEffect,
        lyric_cues: rendered.lyricCues,
        template: project?.template || "LYRICS",
      };

      let savedProject = { ...project, ...projectPatch };
      if (project?.id) {
        await db.entities.VideoProject.update(project.id, projectPatch);
        savedProject = { ...savedProject, id: project.id };
      }

      if (project?.campaign_id) {
        onProgress?.({ phase: "linking", progress: 98, message: "Linking to campaign…" });
        const res = await triggerCampaignAutoVideo({
          campaignId: project.campaign_id,
          videoUrl,
        }).catch((err) => ({ ok: false, error: err?.message || String(err) }));

        return {
          status: "ready",
          isMock: false,
          downloadUrl: videoUrl,
          message: res?.ok
            ? "Promo video rendered on your device and saved to the campaign."
            : "Promo video rendered. Campaign link skipped — you can still download the MP4.",
          project: savedProject,
          result: res,
        };
      }

      return {
        status: "ready",
        isMock: false,
        downloadUrl: videoUrl,
        message: "Promo video rendered on your device.",
        project: savedProject,
      };
    } catch (err) {
      return {
        status: "failed",
        isMock: false,
        downloadUrl: null,
        message: err?.message || "Client video render failed.",
        project,
      };
    }
  },
};

export default videoService;
