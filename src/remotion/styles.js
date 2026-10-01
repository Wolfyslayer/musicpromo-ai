/** Shared Remotion promo video constants. */

export const PROMO_WIDTH = 1080;
export const PROMO_HEIGHT = 1920;
export const PROMO_FPS = 60;
export const PROMO_MAX_DURATION_SEC = 60;
export const EXPORT_DURATIONS = [15, 30, 60];

export const FONT_CHOICES = [
  { id: "sans", label: "Sans" },
  { id: "display", label: "Bold Display" },
  { id: "grunge", label: "Grunge" },
];

export const VISUAL_STYLES = [
  {
    id: "pop",
    label: "Pop / Modern",
    description: "Clean sans-serif, soft fade and zoom on lyrics.",
  },
  {
    id: "hiphop",
    label: "HipHop / Urban",
    description: "Bold uppercase, punchy bounce, neon glow.",
  },
  {
    id: "rock",
    label: "Rock / Metal",
    description: "Distressed typewriter energy and rugged fades.",
  },
];

export function normalizeVisualStyle(value) {
  const id = String(value || "pop").toLowerCase();
  if (id === "hiphop" || id === "urban") return "hiphop";
  if (id === "rock" || id === "metal") return "rock";
  return "pop";
}

export const PARTICLE_EFFECTS = [
  {
    id: "none",
    label: "None",
    description: "Clean frame with no particle overlay.",
  },
  {
    id: "stardust",
    label: "Star Dust",
    description: "Soft anamorphic bokeh spheres drifting in depth with the music.",
  },
  {
    id: "smoke",
    label: "Smoke & Fog",
    description: "Rolling mist that thickens and expands on heavy bass.",
  },
  {
    id: "sparks",
    label: "Fire Sparks",
    description: "Glowing embers that streak upward from the bottom on peaks.",
  },
  {
    id: "leaks",
    label: "Light Leaks",
    description: "Horizontal blue and gold flares that pulse with the track.",
  },
  {
    id: "vhs",
    label: "Retro VHS",
    description: "Chromatic shake, tracking lines, and tape noise on transients.",
  },
  {
    id: "neon",
    label: "Neon Lines",
    description: "Glowing laser grids that warp with the high frequencies.",
  },
  {
    id: "vinyl",
    label: "Vinyl Dust",
    description: "Cinema grain, hairline scratches, and warm retro dust.",
  },
  {
    id: "rings",
    label: "Pulse Rings",
    description: "Concentric rings expanding from behind the artwork with loudness.",
  },
  {
    id: "shake",
    label: "Bass Rumble",
    description: "Frame shake and directional drift locked to kick-drum transients.",
  },
  {
    id: "prism",
    label: "Glitch Prism",
    description: "RGB split and prism warp around the cover, flashing with vocals and synths.",
  },
  {
    id: "fluid",
    label: "Fluid Visualizer",
    description: "Neon rings behind the cover, glowing with the track's loudness.",
  },
  {
    id: "grain",
    label: "Film Grain",
    description: "35mm grain and a soft red halation that follows the mid-tones.",
  },
];

export function normalizeParticleEffect(value) {
  const id = String(value || "none").toLowerCase().replace(/\s+/g, " ");
  if (id === "stardust" || id === "glow" || id === "stars" || id === "star dust" || id === "star dust premium") return "stardust";
  if (id === "smoke" || id === "mist" || id === "fog" || id === "smoke & fog" || id === "cinematic smoke") return "smoke";
  if (id === "sparks" || id === "fire" || id === "fire sparks" || id === "volcanic sparks") return "sparks";
  if (id === "leaks" || id === "light" || id === "anamorphic" || id === "light leaks") return "leaks";
  if (id === "vhs" || id === "glitch" || id === "retro" || id === "retro vhs") return "vhs";
  if (id === "neon" || id === "cyber" || id === "lines" || id === "neon lines") return "neon";
  if (id === "vinyl" || id === "dust" || id === "scratches" || id === "vinyl dust") return "vinyl";
  if (id === "rings" || id === "pulse" || id === "pulse rings") return "rings";
  if (id === "shake" || id === "rumble" || id === "camera" || id === "bass rumble") return "shake";
  if (id === "prism" || id === "chromatic" || id === "glitch prism") return "prism";
  if (id === "fluid" || id === "visualizer" || id === "cyber fluid") return "fluid";
  if (id === "grain" || id === "halation" || id === "film grain" || id === "film") return "grain";
  return "none";
}

export function clampAudioOffset(offset, audioDuration, windowSec) {
  const start = Math.max(0, Number(offset) || 0);
  const span = Math.max(0.2, Number(windowSec) || 15);
  const total = Number(audioDuration);
  if (!Number.isFinite(total) || total <= span) return 0;
  return Math.round(Math.min(Math.max(0, total - span), start) * 1000) / 1000;
}

export function formatClock(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function normalizeExportDuration(value) {
  const n = Number(value);
  if (n === 30 || n === 60) return n;
  return 15;
}

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const DEFAULT_LOOK = {
  fontId: "sans",
  fontSize: 64,
  textColor: "#f2ecff",
  letterSpacing: 0,
  animationMs: 280,
  lyricX: 50,
  lyricY: 82,
  particleX: 50,
  particleY: 88,
  wind: 0.25,
  particleSpeed: 0.45,
};

/** Typography, lyric frame, and particle-source settings for the live preview. */
export function normalizeEditorLook(value) {
  const src = value && typeof value === "object" ? value : {};
  const fontId = FONT_CHOICES.some((font) => font.id === src.fontId) ? src.fontId : DEFAULT_LOOK.fontId;
  const textColor = /^#[0-9a-fA-F]{6}$/.test(String(src.textColor || ""))
    ? String(src.textColor)
    : DEFAULT_LOOK.textColor;
  const round = (n) => Math.round(n * 10) / 10;
  return {
    fontId,
    fontSize: Math.round(clampNum(src.fontSize, 36, 96, DEFAULT_LOOK.fontSize)),
    textColor,
    letterSpacing: round(clampNum(src.letterSpacing, -2, 16, DEFAULT_LOOK.letterSpacing)),
    animationMs: Math.round(clampNum(src.animationMs, 80, 900, DEFAULT_LOOK.animationMs)),
    lyricX: round(clampNum(src.lyricX, 8, 92, DEFAULT_LOOK.lyricX)),
    lyricY: round(clampNum(src.lyricY, 8, 92, DEFAULT_LOOK.lyricY)),
    particleX: round(clampNum(src.particleX, 0, 100, DEFAULT_LOOK.particleX)),
    particleY: round(clampNum(src.particleY, 0, 100, DEFAULT_LOOK.particleY)),
    wind: Math.round(clampNum(src.wind, -1, 1, DEFAULT_LOOK.wind) * 100) / 100,
    particleSpeed: Math.round(clampNum(src.particleSpeed, 0.1, 1, DEFAULT_LOOK.particleSpeed) * 100) / 100,
  };
}

/**
 * Split raw lyrics into cue objects. If times are missing, space evenly across duration.
 */
function roundTime(value) {
  return Number(Math.max(0, Number(value) || 0).toFixed(3));
}

export function buildLyricCues(lyrics, durationSec = 15, existing = []) {
  if (Array.isArray(existing) && existing.length) {
    return existing
      .map((c) => {
        const text = String(c?.text || "").trim();
        const explicitStart = Number(c?.start);
        const stamped = Number(c?.timeSeconds);
        const start = Number.isFinite(stamped)
          ? Math.max(0, stamped)
          : Number.isFinite(explicitStart)
            ? Math.max(0, explicitStart)
            : 0;
        let end = Number(c?.end);
        if (!Number.isFinite(end)) {
          end = start;
        } else if (
          Number.isFinite(explicitStart) &&
          Number.isFinite(stamped) &&
          explicitStart !== stamped
        ) {
          end = end + (stamped - explicitStart);
        }
        end = Math.max(start, end);
        const timeSeconds = roundTime(start);
        return {
          text,
          start: timeSeconds,
          end: Math.max(timeSeconds, roundTime(end)),
          timeSeconds,
        };
      })
      .filter((c) => c.text);
  }

  const lines = String(lyrics || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 48);

  if (!lines.length) return [];

  const dur = Math.max(4, Number(durationSec) || 15);
  const startPad = Math.min(1.2, dur * 0.08);
  const endPad = Math.min(1.0, dur * 0.06);
  const span = Math.max(0.5, dur - startPad - endPad);
  const step = span / Math.max(1, lines.length);

  return lines.map((text, i) => {
    const start = roundTime(startPad + i * step);
    const end = roundTime(Math.min(dur, start + step));
    return {
      text,
      start,
      end,
      timeSeconds: start,
    };
  });
}

/**
 * Cue visible at `timeSec`. A line is on screen from its start through its end.
 * When end is missing or equal to start, it stays up until a later cue begins.
 */
function cueBounds(cue) {
  const start = Number(cue?.timeSeconds ?? cue?.start);
  if (!Number.isFinite(start)) return null;
  const endRaw = Number(cue?.end);
  const end = Number.isFinite(endRaw) ? Math.max(start, endRaw) : start;
  return { start, end };
}

/**
 * Global lyric cues whose start and end both sit inside the trimmed audio window.
 * Stored timestamps are left unchanged.
 */
export function cuesInAudioWindow(cues, offsetSec, durationSec) {
  const offset = Math.max(0, Number(offsetSec) || 0);
  const span = Math.max(0.2, Number(durationSec) || 15);
  const windowEnd = offset + span;
  return (cues || []).filter((cue) => {
    const bounds = cueBounds(cue);
    if (!bounds) return false;
    return bounds.start >= offset - 0.0005 && bounds.end <= windowEnd + 0.0005;
  });
}

export function activeLyricCueIndex(cues, timeSec) {
  if (!Array.isArray(cues) || !cues.length) return -1;
  const time = Number(timeSec) || 0;
  let idx = -1;
  let idxStart = -Infinity;
  for (let i = 0; i < cues.length; i += 1) {
    const start = Number(cues[i]?.timeSeconds ?? cues[i]?.start);
    if (!Number.isFinite(start) || start > time + 0.0005) continue;
    const end = Number(cues[i]?.end);
    if (Number.isFinite(end) && end > start && time >= end - 0.0005) continue;
    if (start >= idxStart) {
      idx = i;
      idxStart = start;
    }
  }
  return idx;
}

export function scaleLyricCues(cues, fromDuration, toDuration) {
  const from = Math.max(0.001, Number(fromDuration) || 15);
  const to = Math.max(1, Number(toDuration) || 15);
  const ratio = to / from;
  return (cues || []).map((cue) => {
    const start = roundTime((Number(cue?.timeSeconds ?? cue?.start) || 0) * ratio);
    const previousEnd = Number(cue?.end);
    const length = Number.isFinite(previousEnd) ? Math.max(0.15, previousEnd - (Number(cue?.timeSeconds ?? cue?.start) || 0)) : 0.4;
    const end = roundTime(Math.min(to, start + length * ratio));
    return { ...cue, start, end: Math.max(start, end), timeSeconds: start };
  });
}

export function activeLyricAtTime(cues, timeSec) {
  const idx = activeLyricCueIndex(cues, timeSec);
  return idx >= 0 ? cues[idx] : null;
}
