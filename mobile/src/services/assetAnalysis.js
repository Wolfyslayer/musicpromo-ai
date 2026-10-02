import { createAudioPlayer } from "expo-audio";

let sessionProfile = null;
const durationCache = new Map();

export function saveAssetSession(profile) {
  sessionProfile = profile || null;
}

export function loadAssetSession() {
  return sessionProfile;
}

function rgbToHsl(r, g, b) {
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

function toHex(r, g, b) {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

export function classifyArtworkColor({ r, g, b }) {
  const { s, l } = rgbToHsl(r, g, b);
  const palette = toHex(r, g, b);
  if (l < 0.28) {
    return {
      theme: "dark",
      label: "Dark / Minimal",
      template: "MINIMAL",
      visualStyle: "rock",
      particleEffect: "smoke",
      palette,
    };
  }
  if (s < 0.16 && l > 0.7) {
    return {
      theme: "minimalist",
      label: "Minimal",
      template: "MINIMAL",
      visualStyle: "pop",
      particleEffect: "none",
      palette,
    };
  }
  if (s > 0.45 && l > 0.28 && l < 0.75) {
    return {
      theme: "vibrant",
      label: "Vibrant",
      template: "HOOK",
      visualStyle: "pop",
      particleEffect: "sparks",
      palette,
    };
  }
  return {
    theme: "moody",
    label: "Moody",
    template: "CINEMATIC",
    visualStyle: "hiphop",
    particleEffect: "stardust",
    palette,
  };
}

export function hooksForVibe({ energy, title }) {
  const name = String(title || "").trim() || "this track";
  if (energy === "fast") {
    return [
      `${name} doesn't ask — it hits.`,
      "Turn it up before the chorus takes over.",
      "Fast, loud, and already moving.",
    ];
  }
  return [
    `Stay with ${name} for a minute.`,
    "A slower song with a sharper hook.",
    "Put this on when the room gets quiet.",
  ];
}

export function energyLabel(energy) {
  return energy === "fast" ? "Fast / Aggressive" : "Slow / Acoustic";
}

function sourceUri(source) {
  if (!source) return "";
  if (typeof source === "string") return source;
  return String(source.uri || source.url || "");
}

export async function analyzeArtworkSource(source) {
  if (!sourceUri(source)) return null;
  return classifyArtworkColor({ r: 28, g: 24, b: 40 });
}

function readAudioDuration(uri, timeoutMs = 6000) {
  return new Promise((resolve) => {
    let player;
    let subscription;
    let timer;
    const finish = (value) => {
      clearTimeout(timer);
      try {
        subscription?.remove();
        player?.remove();
      } catch {
        /* player already released */
      }
      resolve(value);
    };
    try {
      player = createAudioPlayer(uri);
      subscription = player.addListener("playbackStatusUpdate", (status) => {
        if (status?.isLoaded && Number.isFinite(status.duration) && status.duration > 0) {
          finish(status.duration);
        }
      });
      timer = setTimeout(() => finish(null), timeoutMs);
    } catch {
      finish(null);
    }
  });
}

export async function analyzeAudioEnergy(source) {
  const uri = sourceUri(source);
  if (!uri) return null;
  if (!durationCache.has(uri)) durationCache.set(uri, await readAudioDuration(uri));
  const duration = durationCache.get(uri);
  return { energy: null, rms: 0, duration };
}

export async function analyzeCampaignAssets({ artwork, audio, title, energy }) {
  const [visual, sound] = await Promise.all([
    analyzeArtworkSource(artwork),
    analyzeAudioEnergy(audio),
  ]);
  const chosen = energy === "fast" || energy === "slow" ? energy : sound?.energy || "slow";
  const hooks = hooksForVibe({ energy: chosen, title });
  const keywords = [
    visual?.theme,
    energyLabel(chosen),
    visual?.label,
    visual?.palette,
  ].filter(Boolean);
  return {
    theme: visual?.theme || "moody",
    label: visual?.label || "Moody",
    template: visual?.template || "CINEMATIC",
    visualStyle: visual?.visualStyle || "pop",
    particleEffect: visual?.particleEffect || "none",
    palette: visual?.palette || "#1c1828",
    energy: chosen,
    detectedEnergy: sound?.energy || null,
    rms: sound?.rms || 0,
    duration: sound?.duration || null,
    keywords,
    hooks,
  };
}
