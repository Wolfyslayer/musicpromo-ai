const SESSION_KEY = "musicpromo.assetProfile";

export function saveAssetSession(profile) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  } catch {
    /* private mode can block session storage */
  }
}

export function loadAssetSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
  const { h, s, l } = rgbToHsl(r, g, b);
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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Artwork could not be read."));
    image.src = url;
  });
}

export async function analyzeArtworkSource(source) {
  const blobUrl = source instanceof Blob ? URL.createObjectURL(source) : "";
  const url = blobUrl || String(source || "");
  if (!url) return null;
  try {
    const image = await loadImage(url);
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      r += pixels[index];
      g += pixels[index + 1];
      b += pixels[index + 2];
      count += 1;
    }
    return classifyArtworkColor({
      r: r / Math.max(1, count),
      g: g / Math.max(1, count),
      b: b / Math.max(1, count),
    });
  } catch {
    return classifyArtworkColor({ r: 28, g: 24, b: 40 });
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }
}

export async function analyzeAudioEnergy(source) {
  if (!source) return null;
  const context = new AudioContext();
  try {
    const bytes = source instanceof Blob
      ? await source.arrayBuffer()
      : await fetch(source).then((response) => response.arrayBuffer());
    const audio = await context.decodeAudioData(bytes.slice(0));
    const channel = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(channel.length / 12000));
    let sum = 0;
    let crossings = 0;
    let previous = 0;
    let count = 0;
    for (let index = 0; index < channel.length; index += step) {
      const sample = channel[index];
      sum += sample * sample;
      if ((sample >= 0 && previous < 0) || (sample < 0 && previous >= 0)) crossings += 1;
      previous = sample;
      count += 1;
    }
    const rms = Math.sqrt(sum / Math.max(1, count));
    const rate = crossings / Math.max(1, count);
    return {
      energy: rms > 0.12 || rate > 0.16 ? "fast" : "slow",
      rms: Math.round(rms * 1000) / 1000,
      duration: audio.duration,
    };
  } catch {
    return { energy: "slow", rms: 0, duration: null };
  } finally {
    await context.close().catch(() => {});
  }
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
    detectedEnergy: sound?.energy || chosen,
    rms: sound?.rms || 0,
    keywords,
    hooks,
  };
}
