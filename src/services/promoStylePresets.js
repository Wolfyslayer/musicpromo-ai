import { normalizeParticleEffect, normalizeVisualStyle } from "@/remotion/styles";

/** One-tap look for campaign create + video studio defaults. */
export const PROMO_STYLE_PRESETS = [
  {
    id: "viral-pop",
    label: "Viral Pop",
    tagline: "Bright hooks, punchy motion",
    visualStyle: "pop",
    particleEffect: "rings",
    defaultTemplate: "HOOK",
  },
  {
    id: "club-electronic",
    label: "Club / Electronic",
    tagline: "Neon grids & bass shake",
    visualStyle: "electronic",
    particleEffect: "neon",
    defaultTemplate: "WAVEFORM",
  },
  {
    id: "hiphop-street",
    label: "Hip-Hop",
    tagline: "Bold type, sparks & grit",
    visualStyle: "hiphop",
    particleEffect: "sparks",
    defaultTemplate: "HOOK",
  },
  {
    id: "cinematic-film",
    label: "Cinematic",
    tagline: "Slow parallax, light leaks",
    visualStyle: "cinematic",
    particleEffect: "leaks",
    defaultTemplate: "CINEMATIC",
  },
  {
    id: "rnb-mood",
    label: "R&B / Mood",
    tagline: "Soft glow, star dust",
    visualStyle: "rnb",
    particleEffect: "stardust",
    defaultTemplate: "MINIMAL",
  },
  {
    id: "rock-raw",
    label: "Rock / Alt",
    tagline: "Typewriter lyrics, grain",
    visualStyle: "rock",
    particleEffect: "grain",
    defaultTemplate: "LYRICS",
  },
  {
    id: "retro-vhs",
    label: "Retro VHS",
    tagline: "Tape nostalgia & prism",
    visualStyle: "pop",
    particleEffect: "vhs",
    defaultTemplate: "CINEMATIC",
  },
  {
    id: "minimal-release",
    label: "Clean Release",
    tagline: "Minimal frame, outro CTA",
    visualStyle: "pop",
    particleEffect: "none",
    defaultTemplate: "RELEASE",
  },
];

export function getPromoStylePreset(id) {
  return PROMO_STYLE_PRESETS.find((p) => p.id === id) || PROMO_STYLE_PRESETS[0];
}

export function normalizePromoStyleChoice(presetId, overrides = {}) {
  const preset = getPromoStylePreset(presetId);
  return {
    presetId: preset.id,
    visualStyle: normalizeVisualStyle(overrides.visualStyle || preset.visualStyle),
    particleEffect: normalizeParticleEffect(overrides.particleEffect || preset.particleEffect),
    defaultTemplate: String(overrides.defaultTemplate || preset.defaultTemplate || "HOOK").toUpperCase(),
  };
}
