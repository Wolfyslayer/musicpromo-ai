export const FONT_CHOICES = [
  { id: "sans", label: "Sans" },
  { id: "display", label: "Bold Display" },
  { id: "grunge", label: "Grunge" },
];

export const PARTICLE_EFFECTS = [
  { id: "none", label: "None" },
  { id: "stardust", label: "Star Dust" },
  { id: "smoke", label: "Smoke" },
  { id: "sparks", label: "Sparks" },
  { id: "leaks", label: "Light Leaks" },
  { id: "vhs", label: "Retro VHS" },
  { id: "neon", label: "Neon Lines" },
  { id: "vinyl", label: "Vinyl Dust" },
  { id: "rings", label: "Pulse Rings" },
  { id: "shake", label: "Bass Rumble" },
  { id: "prism", label: "Glitch Prism" },
  { id: "fluid", label: "Fluid" },
  { id: "grain", label: "Film Grain" },
];

export type EditorLook = {
  fontId: string;
  fontSize: number;
  textColor: string;
  letterSpacing: number;
  animationMs: number;
  lyricX: number;
  lyricY: number;
  particleX: number;
  particleY: number;
  wind: number;
  particleSpeed: number;
};

const DEFAULT_LOOK: EditorLook = {
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

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeEditorLook(value?: Partial<EditorLook> | null): EditorLook {
  const src = value || {};
  const fontId = FONT_CHOICES.some((font) => font.id === src.fontId) ? String(src.fontId) : DEFAULT_LOOK.fontId;
  const textColor = /^#[0-9a-fA-F]{6}$/.test(String(src.textColor || "")) ? String(src.textColor) : DEFAULT_LOOK.textColor;
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    fontId,
    fontSize: Math.round(clamp(src.fontSize, 36, 96, DEFAULT_LOOK.fontSize)),
    textColor,
    letterSpacing: round(clamp(src.letterSpacing, -2, 16, DEFAULT_LOOK.letterSpacing)),
    animationMs: Math.round(clamp(src.animationMs, 80, 900, DEFAULT_LOOK.animationMs)),
    lyricX: round(clamp(src.lyricX, 8, 92, DEFAULT_LOOK.lyricX)),
    lyricY: round(clamp(src.lyricY, 8, 92, DEFAULT_LOOK.lyricY)),
    particleX: round(clamp(src.particleX, 0, 100, DEFAULT_LOOK.particleX)),
    particleY: round(clamp(src.particleY, 0, 100, DEFAULT_LOOK.particleY)),
    wind: Math.round(clamp(src.wind, -1, 1, DEFAULT_LOOK.wind) * 100) / 100,
    particleSpeed: Math.round(clamp(src.particleSpeed, 0.1, 1, DEFAULT_LOOK.particleSpeed) * 100) / 100,
  };
}

export function resolveStudioDuration(videoType: string, value: number, audioSeconds?: number | null) {
  if (videoType === "promo") return Number(value) === 30 ? 30 : 15;
  if (videoType === "lyrics") {
    const audio = Number(audioSeconds);
    const full = Number.isFinite(audio) && audio >= 8 ? audio : 180;
    return Math.min(600, Math.max(8, Math.round(full)));
  }
  return value === 30 || value === 60 ? value : 15;
}

export function clampAudioOffset(offset: number, audioDuration: number, windowSec: number) {
  const start = Math.max(0, Number(offset) || 0);
  const span = Math.max(0.2, Number(windowSec) || 15);
  const total = Number(audioDuration);
  if (!Number.isFinite(total) || total <= span) return 0;
  return Math.round(Math.min(Math.max(0, total - span), start) * 1000) / 1000;
}
