import { db } from "@/lib/db";
import { decodeBase64, uploadArrayBuffer } from "@/lib/store";
import { triggerCampaignAutoVideo } from "@/lib/social";
import type { LyricCue } from "@/lib/lyrics";

export async function saveRenderedPromo(input: {
  base64: string;
  campaignId?: string;
  songId?: string;
  title: string;
  artistName: string;
  text: string;
  artworkUrl: string;
  audioUrl: string;
  lyrics: string;
  visualStyle?: string;
  particleEffect?: string;
  lyricCues?: LyricCue[];
  look?: Record<string, unknown>;
  videoType?: string;
  outroCta?: string;
  audioStartTimeOffset?: number;
  duration: number;
  width: number;
  height: number;
  userId?: string;
}) {
  const uploaded = await uploadArrayBuffer(decodeBase64(input.base64), "promo.mp4", "video/mp4", "video");
  const videoUrl = uploaded.file_url;
  if (!videoUrl) throw new Error("Upload succeeded but no public video URL was returned.");
  const project = await db.entities.VideoProject.create({
    campaign_id: input.campaignId || null,
    song_id: input.songId || null,
    template: "LYRICS",
    title: input.title,
    artist_name: input.artistName,
    text: input.text,
    artwork_url: input.artworkUrl,
    audio_url: input.audioUrl,
    file_url: videoUrl,
    lyrics: String(input.lyrics || "").slice(0, 2000),
    visual_style: input.visualStyle || "pop",
    particle_effect: input.particleEffect || "none",
    editor_look: input.look || null,
    video_type: input.videoType || "promo",
    outro_cta: input.outroCta || "",
    audioStartTimeOffset: input.audioStartTimeOffset || 0,
    lyric_cues: input.lyricCues || [],
    duration: input.duration,
    aspect_ratio: "9:16",
    resolution: `${input.width}x${input.height}`,
    output_format: "mp4",
    rendering_status: "complete",
    render_output_url: videoUrl,
    status: "ready",
    is_demo: false,
    user_id: input.userId || "",
  });
  if (input.campaignId) {
    await triggerCampaignAutoVideo({ campaignId: input.campaignId, videoUrl }).catch(() => null);
  }
  return { project, videoUrl };
}
