export function hooksForVibe({ energy, title }: { energy?: string; title?: string }) {
  const name = String(title || "").trim() || "this track";
  if (energy === "fast") {
    return [`${name} doesn't ask — it hits.`, "Turn it up before the chorus takes over.", "Fast, loud, and already moving."];
  }
  return [`Stay with ${name} for a minute.`, "A slower song with a sharper hook.", "Put this on when the room gets quiet."];
}

export function energyLabel(energy?: string) {
  return energy === "fast" ? "Fast / Aggressive" : "Slow / Acoustic";
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    else if (max === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: saturation, l: lightness };
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

export function classifyArtworkColor({ r, g, b }: { r: number; g: number; b: number }) {
  const { s, l } = rgbToHsl(r, g, b);
  const palette = toHex(r, g, b);
  if (l < 0.28) return { theme: "dark", label: "Dark / Minimal", template: "MINIMAL", visualStyle: "rock", particleEffect: "smoke", palette };
  if (s < 0.16 && l > 0.7) return { theme: "minimalist", label: "Minimal", template: "MINIMAL", visualStyle: "pop", particleEffect: "none", palette };
  if (s > 0.45 && l > 0.28 && l < 0.75) return { theme: "vibrant", label: "Vibrant", template: "HOOK", visualStyle: "pop", particleEffect: "sparks", palette };
  return { theme: "moody", label: "Moody", template: "CINEMATIC", visualStyle: "hiphop", particleEffect: "stardust", palette };
}

export function profileFromSamples({
  color,
  sound,
  title,
  energy,
}: {
  color?: { r: number; g: number; b: number } | null;
  sound?: { energy?: string; rms?: number; duration?: number | null } | null;
  title?: string;
  energy?: string;
}) {
  const visual = color ? classifyArtworkColor(color) : null;
  const chosen = energy === "fast" || energy === "slow" ? energy : sound?.energy || "slow";
  return {
    theme: visual?.theme || "moody",
    label: visual?.label || "Moody",
    template: visual?.template || "CINEMATIC",
    visualStyle: visual?.visualStyle || "pop",
    particleEffect: visual?.particleEffect || "none",
    palette: visual?.palette || "#1c1828",
    energy: chosen,
    detectedEnergy: sound?.energy || chosen,
    rms: sound?.rms || 0,
    duration: sound?.duration ?? null,
    keywords: [visual?.theme, energyLabel(chosen), visual?.label, visual?.palette].filter(Boolean),
    hooks: hooksForVibe({ energy: chosen, title }),
  };
}
