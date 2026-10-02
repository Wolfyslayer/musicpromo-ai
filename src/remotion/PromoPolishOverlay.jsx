import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const W = 540;
const H = 960;

function drawGrain(ctx, frame) {
  ctx.clearRect(0, 0, W, H);
  const alpha = 0.055;
  const seed = frame * 7919;
  for (let i = 0; i < 2800; i += 1) {
    const x = (Math.sin(i * 12.9898 + seed) * 43758.5453) % W;
    const y = (Math.sin(i * 78.233 + seed * 0.7) * 23421.631) % H;
    const px = Math.abs(x);
    const py = Math.abs(y);
    const v = 200 + Math.floor((Math.sin(i + seed) * 0.5 + 0.5) * 55);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(px, py, 1, 1);
  }
}

/**
 * Cinematic post layer: grain, beat flash, anamorphic sweep — reads "generative" without cloud AI.
 */
export default function PromoPolishOverlay({ enabled, bass = 0, mid = 0, transient = 0, suspend = false }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef(null);

  useLayoutEffect(() => {
    if (!enabled || suspend) return undefined;
    const handle = delayRender("promo-polish-grain");
    try {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { alpha: true });
      if (ctx) drawGrain(ctx, frame);
    } finally {
      continueRender(handle);
    }
    return undefined;
  }, [enabled, suspend, frame]);

  if (!enabled || suspend) return null;

  const t = frame / Math.max(1, fps);
  const sweepPhase = (t * 0.22) % 1;
  const sweepX = interpolate(sweepPhase, [0, 1], [-35, 135]);
  const beatFlash = Math.min(0.16, transient * 1.1 + bass * 0.06);
  const midGlow = Math.min(0.08, mid * 0.12);
  const vignettePulse = 0.55 + Math.min(0.12, bass * 0.2);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "normal" }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: "100%", height: "100%", display: "block", opacity: 0.85 }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 85% 70% at 50% 45%, transparent 0%, rgba(0,0,0,${vignettePulse}) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: beatFlash + midGlow,
          background: `linear-gradient(125deg, rgba(167,139,250,${midGlow}) 0%, rgba(255,255,255,${beatFlash}) 40%, rgba(56,189,248,${midGlow * 0.6}) 100%)`,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${sweepX}%`,
          width: "28%",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,220,180,0.07) 45%, rgba(255,255,255,0.14) 50%, rgba(180,220,255,0.06) 55%, transparent 100%)",
          transform: "skewX(-12deg)",
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: interpolate(
            frame,
            [0, 12, durationInFrames - 15, durationInFrames],
            [0, 0.035, 0.035, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          ),
          boxShadow: "inset 0 0 120px 40px rgba(0,0,0,0.45)",
        }}
      />
    </AbsoluteFill>
  );
}
