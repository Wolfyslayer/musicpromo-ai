import { buildLyricCues, normalizeEditorLook, normalizeExportDuration } from "@/remotion/styles";

/** Same-origin demo media so guests can preview without an account. */
export const DEMO_ARTWORK_URL = "/demo/cover.jpg";
export const DEMO_AUDIO_URL = "/demo/track.mp3";

export const DEMO_LYRICS = [
  "City lights in the rearview",
  "We don't need a map tonight",
  "Turn it up and let it move",
  "Hold the chorus in the light",
].join("\n");

export function createDemoProject(durationSec = 15) {
  const duration = normalizeExportDuration(durationSec);
  return {
    template: "LYRICS",
    title: "Midnight Drive",
    artist_name: "Demo Session",
    text: "A guest preview you can play, restyle, and watch live.",
    artwork_url: DEMO_ARTWORK_URL,
    audio_url: DEMO_AUDIO_URL,
    lyrics: DEMO_LYRICS,
    visual_style: "pop",
    particle_effect: "stardust",
    editor_look: normalizeEditorLook(null),
    lyric_cues: buildLyricCues(DEMO_LYRICS, duration, []),
    audioStartTimeOffset: 0,
    duration,
    is_demo_preview: true,
  };
}
