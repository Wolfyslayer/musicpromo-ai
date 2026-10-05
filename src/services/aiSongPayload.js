import { normalizeSongForAI } from "@/services/songLanguage";
import { sortReleaseTracks } from "@/services/releaseTracks";

/**
 * Payload for analyzeSong / generateCampaign — includes artwork + audio URLs for multimodal Gemini.
 */
export function buildAiSongPayload({ song, artistName, release = null, allSongs = null }) {
  const base = normalizeSongForAI(song, artistName);
  const ordered = sortReleaseTracks(allSongs?.length ? allSongs : song ? [song] : []);
  const artworkUrl =
    release?.artwork_url ||
    song?.artwork_url ||
    ordered.find((s) => s.artwork_url)?.artwork_url ||
    "";

  const tracks =
    ordered.length > 1
      ? ordered.map((s) => ({
          title: s.title || "Untitled",
          audio_url: s.audio_url || "",
          audio_duration: s.audio_duration ?? null,
          track_number: s.track_number ?? null,
        }))
      : undefined;

  const focus = song || ordered[0] || {};
  const audioUrl = focus.audio_url || ordered[0]?.audio_url || "";

  return {
    ...base,
    title: base.title || focus.title || "Untitled",
    description: base.description || focus.description || "",
    lyrics: base.lyrics ?? focus.lyrics ?? "",
    artwork_url: artworkUrl,
    audio_url: audioUrl,
    audio_duration: focus.audio_duration ?? ordered[0]?.audio_duration ?? null,
    release_title: release?.title || "",
    release_type: release?.release_type || "",
    tracks,
    assetProfile: song?.analysis?.assetProfile || null,
  };
}
