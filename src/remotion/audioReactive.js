import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { createElement } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

const IDLE_MOTION = {
  bassScale: 1,
  transientScale: 1,
  bass: 0,
  mid: 0,
  high: 0,
  energy: 0,
  transient: 0,
  ready: false,
};

/**
 * Frame-accurate bass + transient reactivity for Remotion preview and export.
 * `audioSrc` must be a non-empty URL. Callers without audio should use
 * `PromoAudioMotion`, which skips this hook.
 */
export function usePromoAudioMotion(audioSrc, offsetSec = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(audioSrc);
  const sampleFrame = frame + Math.max(0, Math.round((Number(offsetSec) || 0) * fps));

  if (!audioData) return IDLE_MOTION;

  const spectrum = visualizeAudio({
    fps,
    frame: sampleFrame,
    audioData,
    numberOfSamples: 64,
    smoothing: true,
  });

  const bassBins = spectrum.slice(0, 8);
  const midBins = spectrum.slice(8, 24);
  const bass =
    bassBins.reduce((a, b) => a + b, 0) / Math.max(1, bassBins.length);
  const mid =
    midBins.reduce((a, b) => a + b, 0) / Math.max(1, midBins.length);
  const highBins = spectrum.slice(24, 48);
  const high = highBins.reduce((a, b) => a + b, 0) / Math.max(1, highBins.length);

  const prevSpectrum = visualizeAudio({
    fps,
    frame: Math.max(0, sampleFrame - 1),
    audioData,
    numberOfSamples: 64,
    smoothing: true,
  });
  const prevEnergy =
    prevSpectrum.reduce((a, b) => a + b, 0) / Math.max(1, prevSpectrum.length);
  const energy = spectrum.reduce((a, b) => a + b, 0) / Math.max(1, spectrum.length);
  const transient = Math.max(0, energy - prevEnergy);

  const bassScale = 1 + Math.min(0.14, bass * 0.55);
  const transientScale = 1 + Math.min(0.1, mid * 0.25 + transient * 1.8);

  return {
    bassScale,
    transientScale,
    bass: Math.min(1, Math.max(0, bass)),
    mid: Math.min(1, Math.max(0, mid)),
    high: Math.min(1, Math.max(0, high)),
    energy: Math.min(1, Math.max(0, energy)),
    transient: Math.min(1, Math.max(0, transient * 6)),
    ready: true,
  };
}

function MeasuredPromoAudioMotion({ audioSrc, offsetSec, children }) {
  const motion = usePromoAudioMotion(audioSrc, offsetSec);
  return children(motion);
}

/** Renders children with audio motion, including clips that have no audio yet. */
export function PromoAudioMotion({ audioSrc, offsetSec = 0, children }) {
  if (!audioSrc) return children(IDLE_MOTION);
  return createElement(MeasuredPromoAudioMotion, { audioSrc, offsetSec }, children);
}
