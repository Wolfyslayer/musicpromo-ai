import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { normalizeParticleEffect } from "./styles";

const WIDTH = 540;
const HEIGHT = 960;
const MAX_PARTICLES = 72;

const phase = new Float32Array(MAX_PARTICLES);
const drift = new Float32Array(MAX_PARTICLES);
for (let i = 0; i < MAX_PARTICLES; i += 1) {
  phase[i] = fract(Math.sin(i * 127.1 + 311.7) * 43758.5453);
  drift[i] = fract(Math.sin(i * 269.5 + 183.3) * 43758.5453);
}

const contexts = new WeakMap();
const sprites = {};

function fract(value) {
  return value - Math.floor(value);
}

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function contextOf(canvas) {
  let ctx = contexts.get(canvas);
  if (!ctx) {
    ctx = canvas.getContext("2d", { alpha: true });
    if (ctx) contexts.set(canvas, ctx);
  }
  return ctx;
}

function glowSprite(key, stops, width = 128, height = 128) {
  if (sprites[key]) return sprites[key];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.min(width, height) / 2);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  sprites[key] = canvas;
  return canvas;
}

function spritesFor(style) {
  if (style === "smoke") {
    return {
      glow: glowSprite("smoke", [
        [0, "rgba(226,232,240,0.55)"],
        [0.35, "rgba(148,163,184,0.22)"],
        [1, "rgba(100,116,139,0)"],
      ], 160, 160),
    };
  }
  if (style === "sparks") {
    return {
      glow: glowSprite("spark", [
        [0, "rgba(255,244,214,0.98)"],
        [0.22, "rgba(255,140,40,0.72)"],
        [0.55, "rgba(255,60,0,0.18)"],
        [1, "rgba(120,20,0,0)"],
      ], 96, 32),
    };
  }
  if (style === "leaks") return { glow: null };
  return {
    glow: glowSprite("dust", [
      [0, "rgba(255,255,255,0.95)"],
      [0.18, "rgba(186,230,253,0.55)"],
      [0.45, "rgba(99,102,241,0.16)"],
      [1, "rgba(30,58,138,0)"],
    ]),
    gold: glowSprite("dust-gold", [
      [0, "rgba(255,250,230,0.9)"],
      [0.3, "rgba(251,191,36,0.28)"],
      [1, "rgba(245,158,11,0)"],
    ]),
  };
}

function reset(ctx) {
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-over";
}

function drawStarDust(ctx, frame, fps, bass, speed, wind, sourceX, sourceY) {
  const t = frame / Math.max(1, fps);
  const bassN = clamp01(bass);
  const speedN = clamp01((Number(speed) - 0.1) / 0.9);
  const windN = Math.max(-1, Math.min(1, Number(wind) || 0));
  const originX = clamp01(Number(sourceX) / 100) * WIDTH;
  const originY = clamp01(Number(sourceY) / 100) * HEIGHT;
  const { glow, gold } = spritesFor("stardust");
  const count = Math.min(MAX_PARTICLES, 34 + Math.round(speedN * 22));
  const rate = 0.04 + speedN * 0.08 + bassN * 0.05;

  ctx.globalCompositeOperation = "screen";
  ctx.filter = "blur(6px)";
  for (let i = 0; i < count; i += 1) {
    const depth = 0.25 + drift[i] * 0.75;
    const life = fract(t * rate * (0.45 + depth) + phase[i]);
    const driftX = Math.sin(t * (0.25 + depth * 0.4) + phase[i] * 8) * (18 + depth * 36);
    const x = originX + (drift[i] - 0.5) * WIDTH * 0.9 + driftX + windN * life * 70 * depth;
    const y = ((originY - life * HEIGHT * (0.35 + depth * 0.7)) % HEIGHT + HEIGHT) % HEIGHT;
    const radius = (10 + depth * 34) * (0.75 + bassN * 0.9) * (0.8 + speedN * 0.35);
    const sprite = i % 5 === 0 ? gold : glow;
    ctx.globalAlpha = (0.18 + depth * 0.45) * (0.55 + bassN * 0.45);
    ctx.drawImage(sprite, x - radius, y - radius * 0.62, radius * 2.4, radius * 1.24);
  }
  reset(ctx);
}

function drawSmoke(ctx, frame, fps, bass, energy, speed, wind, sourceX, sourceY) {
  const t = frame / Math.max(1, fps);
  const bassN = clamp01(bass);
  const energyN = clamp01(energy);
  const speedN = clamp01((Number(speed) - 0.1) / 0.9);
  const windN = Math.max(-1, Math.min(1, Number(wind) || 0));
  const originX = clamp01(Number(sourceX) / 100) * WIDTH;
  const originY = clamp01(Number(sourceY) / 100) * HEIGHT;
  const { glow } = spritesFor("smoke");
  const count = 8 + Math.round(energyN * 6);
  const density = 0.22 + bassN * 0.55;

  ctx.globalCompositeOperation = "screen";
  ctx.filter = "blur(14px)";
  for (let i = 0; i < count; i += 1) {
    const life = fract(t * (0.018 + speedN * 0.03) + phase[i]);
    const roll = Math.sin(t * (0.35 + drift[i]) + phase[i] * 6) * (30 + bassN * 24);
    const x = originX + (drift[i] - 0.5) * 340 + roll + windN * life * 120;
    const y = originY - life * HEIGHT * (0.22 + speedN * 0.2) + Math.cos(t * 0.4 + i) * 18;
    const radius = (78 + drift[i] * 70) * (1 + bassN * 0.7);
    ctx.globalAlpha = density * (0.35 + drift[i] * 0.4) * (1 - life * 0.35);
    ctx.drawImage(glow, x - radius, y - radius * 0.72, radius * 2.1, radius * 1.5);
  }
  reset(ctx);
}

function drawSparks(ctx, frame, fps, bass, transient, speed, wind) {
  const t = frame / Math.max(1, fps);
  const bassN = clamp01(bass);
  const transientN = clamp01(transient);
  const speedN = clamp01((Number(speed) - 0.1) / 0.9);
  const windN = Math.max(-1, Math.min(1, Number(wind) || 0));
  const { glow } = spritesFor("sparks");
  const burst = transientN > 0.08 ? transientN : bassN * 0.35;
  const count = Math.min(MAX_PARTICLES, 18 + Math.round(speedN * 20 + burst * 28));
  const rate = 0.35 + speedN * 0.4 + burst * 0.55;

  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < count; i += 1) {
    const life = fract(t * rate + phase[i]);
    const spread = (drift[i] - 0.5) * (160 + burst * 80);
    const x = WIDTH * 0.5 + spread + windN * life * 90;
    const travel = HEIGHT * (0.35 + speedN * 0.45 + burst * 0.2);
    const y = HEIGHT - 12 - life * travel;
    const len = 14 + burst * 42 + speedN * 16 + (1 - life) * 10;
    const thick = 3 + burst * 3.5;
    const angle = Math.atan2(-travel, windN * 40 + (drift[i] - 0.5) * 24);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = (1 - life) * (0.45 + burst * 0.55);
    ctx.drawImage(glow, -len / 2, -thick / 2, len, thick);
    ctx.restore();
  }
  reset(ctx);
}

function drawLeaks(ctx, frame, fps, mid, energy) {
  const t = frame / Math.max(1, fps);
  const midN = clamp01(mid);
  const energyN = clamp01(energy);
  const pulse = 0.28 + midN * 0.5 + energyN * 0.22;

  ctx.globalCompositeOperation = "screen";
  ctx.filter = "blur(16px)";
  for (let i = 0; i < 4; i += 1) {
    const sweep = fract(t * (0.045 + i * 0.012) + phase[i]);
    const x = sweep * (WIDTH + 220) - 110;
    const y = HEIGHT * (0.16 + drift[i] * 0.68) + Math.sin(t * 0.6 + i) * 16;
    const blue = i % 2 === 0;
    const gradient = ctx.createLinearGradient(x - 210, y, x + 210, y);
    const core = blue
      ? `rgba(56,189,248,${pulse * 0.85})`
      : `rgba(251,191,36,${pulse * 0.8})`;
    const edge = blue ? "rgba(37,99,235,0)" : "rgba(245,158,11,0)";
    gradient.addColorStop(0, edge);
    gradient.addColorStop(0.5, core);
    gradient.addColorStop(1, edge);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 220, y - 22 - midN * 10, 440, 44 + midN * 20);
  }
  reset(ctx);
}

function drawVhs(ctx, frame, fps, transient) {
  const t = frame / Math.max(1, fps);
  const hit = clamp01(transient);
  const shake = hit * 16;
  ctx.globalCompositeOperation = "screen";
  for (let y = 0; y < HEIGHT; y += 4) {
    ctx.globalAlpha = y % 8 === 0 ? 0.05 : 0.14;
    ctx.fillStyle = y % 8 === 0 ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.85)";
    ctx.fillRect(0, y, WIDTH, 1);
  }
  const bar = Math.floor(fract(t * 0.17 + hit * 0.4) * HEIGHT);
  ctx.globalAlpha = 0.22 + hit * 0.55;
  ctx.fillStyle = "rgba(255,48,96,0.9)";
  ctx.fillRect(-shake, bar, WIDTH + shake * 2, 6 + hit * 16);
  ctx.fillStyle = "rgba(48,220,255,0.85)";
  ctx.fillRect(shake, bar + 8, WIDTH, 4 + hit * 8);
  const specks = 10 + Math.round(hit * 28);
  for (let i = 0; i < specks; i += 1) {
    const x = fract(phase[i] + t * (0.2 + drift[i])) * WIDTH;
    const y = fract(drift[i] + t * 0.35) * HEIGHT;
    ctx.globalAlpha = 0.15 + hit * 0.5;
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.9)" : "rgba(255,80,120,0.8)";
    ctx.fillRect(x, y, 2 + hit * 6, 1);
  }
  reset(ctx);
}

function drawNeon(ctx, frame, fps, high) {
  const t = frame / Math.max(1, fps);
  const highN = clamp01(high);
  ctx.globalCompositeOperation = "screen";
  ctx.lineWidth = 1.4 + highN * 1.6;
  ctx.strokeStyle = `rgba(168, 85, 247, ${0.35 + highN * 0.5})`;
  ctx.beginPath();
  for (let row = 0; row < 7; row += 1) {
    for (let x = 0; x <= WIDTH; x += 14) {
      const y = ((row + 0.5) / 7) * HEIGHT + Math.sin(x * 0.03 + t * (1.4 + highN) + row) * (8 + highN * 28);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.strokeStyle = `rgba(244, 114, 182, ${0.28 + highN * 0.45})`;
  ctx.beginPath();
  for (let col = 1; col < 6; col += 1) {
    const x = (col / 6) * WIDTH + Math.sin(t * 0.8 + col) * (6 + highN * 18);
    ctx.moveTo(x, 0);
    ctx.lineTo(x + Math.sin(t + col) * 20 * highN, HEIGHT);
  }
  ctx.stroke();
  reset(ctx);
}

function drawVinyl(ctx, frame, fps, energy) {
  const t = frame / Math.max(1, fps);
  const energyN = clamp01(energy);
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 48; i += 1) {
    const x = fract(phase[i] + t * (0.01 + drift[i] * 0.02)) * WIDTH;
    const y = fract(drift[i] * 3.1 + t * 0.015) * HEIGHT;
    const radius = 1 + drift[i] * 2.2;
    ctx.globalAlpha = 0.12 + energyN * 0.2;
    ctx.fillStyle = i % 4 === 0 ? "rgba(255, 214, 160, 0.9)" : "rgba(255,255,255,0.75)";
    ctx.fillRect(x, y, radius, radius);
  }
  for (let i = 0; i < 4; i += 1) {
    const x = fract(phase[i + 8] + t * (0.04 + i * 0.01)) * (WIDTH + 40) - 20;
    ctx.globalAlpha = 0.18 + energyN * 0.25;
    ctx.strokeStyle = "rgba(255, 236, 214, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (drift[i] - 0.5) * 30, HEIGHT);
    ctx.stroke();
  }
  reset(ctx);
}

function drawRings(ctx, frame, fps, energy, bass) {
  const t = frame / Math.max(1, fps);
  const loud = clamp01(energy * 0.65 + bass * 0.35);
  const cx = WIDTH / 2;
  const cy = 410;
  const coverRadius = 186;
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 5; i += 1) {
    const life = fract(t * (0.28 + loud * 0.45) + i * 0.2);
    const radius = coverRadius + life * (36 + loud * 210);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(196, 160, 255, ${(1 - life) * (0.2 + loud * 0.75)})`;
    ctx.lineWidth = 2 + loud * 5;
    ctx.stroke();
  }
  reset(ctx);
}

function drawShake(ctx, frame, fps, bass, transient) {
  const t = frame / Math.max(1, fps);
  const kick = clamp01(bass * 0.35 + transient * 1.7);
  const dir = Math.sin(t * 2.4);
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 5; i += 1) {
    const y = fract(phase[i] + dir * kick) * HEIGHT;
    ctx.globalAlpha = 0.08 + kick * 0.45;
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.85)" : "rgba(196,160,255,0.7)";
    ctx.fillRect(dir * kick * 28, y, WIDTH, 1 + kick * 3);
  }
  reset(ctx);
}

function drawPrism(ctx, frame, fps, mid, high) {
  const t = frame / Math.max(1, fps);
  const hit = clamp01(mid * 0.4 + high * 0.75);
  const cx = WIDTH / 2;
  const cy = 410;
  const size = 176;
  const shift = 3 + hit * 18 + Math.sin(t * 9) * hit * 6;
  ctx.globalCompositeOperation = "screen";
  ctx.lineWidth = 3 + hit * 4;
  const bands = [
    ["rgba(255,48,72,0.85)", -shift, 0],
    ["rgba(80,255,160,0.7)", 0, shift * 0.6],
    ["rgba(70,140,255,0.85)", shift, -shift * 0.4],
  ];
  for (let i = 0; i < bands.length; i += 1) {
    const [color, dx, dy] = bands[i];
    ctx.globalAlpha = 0.25 + hit * 0.6;
    ctx.strokeStyle = color;
    ctx.strokeRect(cx - size + dx, cy - size + dy, size * 2, size * 2);
  }
  reset(ctx);
}

function drawFluid(ctx, frame, fps, energy, bass) {
  const t = frame / Math.max(1, fps);
  const loud = clamp01(energy * 0.6 + bass * 0.4);
  const cx = WIDTH / 2;
  const cy = 410;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.shadowColor = "rgba(168, 85, 247, 0.95)";
  ctx.shadowBlur = 12 + loud * 8;
  ctx.lineWidth = 2 + loud * 2.5;
  for (let i = 0; i < 6; i += 1) {
    const life = fract(t * (0.2 + loud * 0.28) + i * 0.16);
    const radius = 190 + life * (24 + loud * 130);
    const wobble = Math.sin(t * 1.6 + i) * (3 + loud * 8);
    ctx.beginPath();
    ctx.arc(cx, cy, radius + wobble, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${120 + i * 18}, ${210 + i * 4}, 255, ${(1 - life) * (0.28 + loud * 0.65)})`;
    ctx.stroke();
  }
  ctx.restore();
  reset(ctx);
}

function drawGrain(ctx, frame, fps, mid) {
  const t = frame / Math.max(1, fps);
  const midN = clamp01(mid);
  const halo = glowSprite("halation", [
    [0, "rgba(255,64,72,0.0)"],
    [0.45, `rgba(255,42,64,${0.15 + midN * 0.45})`],
    [1, "rgba(255,20,40,0)"],
  ], 220, 220);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.35 + midN * 0.5;
  ctx.drawImage(halo, WIDTH / 2 - 210, 250, 420, 420);
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 64; i += 1) {
    const x = fract(phase[i] + t * (0.03 + drift[i] * 0.02)) * WIDTH;
    const y = fract(drift[i] * 4.1 + t * 0.02) * HEIGHT;
    ctx.globalAlpha = 0.05 + midN * 0.1;
    ctx.fillStyle = i % 5 === 0 ? "rgba(255,220,210,0.9)" : "rgba(255,255,255,0.75)";
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  reset(ctx);
}

function drawParticles(ctx, style, frame, fps, bass, mid, high, energy, transient, sourceX, sourceY, wind, speed) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  reset(ctx);
  if (style === "smoke") {
    drawSmoke(ctx, frame, fps, bass, energy, speed, wind, sourceX, sourceY);
    return;
  }
  if (style === "sparks") {
    drawSparks(ctx, frame, fps, bass, transient, speed, wind);
    return;
  }
  if (style === "leaks") {
    drawLeaks(ctx, frame, fps, mid, energy);
    return;
  }
  if (style === "vhs") {
    drawVhs(ctx, frame, fps, transient);
    return;
  }
  if (style === "neon") {
    drawNeon(ctx, frame, fps, high);
    return;
  }
  if (style === "vinyl") {
    drawVinyl(ctx, frame, fps, energy);
    return;
  }
  if (style === "rings") {
    drawRings(ctx, frame, fps, energy, bass);
    return;
  }
  if (style === "shake") {
    drawShake(ctx, frame, fps, bass, transient);
    return;
  }
  if (style === "prism") {
    drawPrism(ctx, frame, fps, mid, high);
    return;
  }
  if (style === "fluid") {
    drawFluid(ctx, frame, fps, energy, bass);
    return;
  }
  if (style === "grain") {
    drawGrain(ctx, frame, fps, mid);
    return;
  }
  drawStarDust(ctx, frame, fps, bass, speed, wind, sourceX, sourceY);
}

/**
 * Frame-accurate particle layer. Motion is a function of the frame, audio,
 * and editor settings, so the live preview and MP4 export match.
 * Sprites are cached for the page lifetime. Nothing is allocated per particle.
 */
export default function ParticleOverlay({
  effect = "none",
  bass = 0,
  mid = 0,
  high = 0,
  energy = 0,
  transient = 0,
  sourceX = 50,
  sourceY = 88,
  lyricX = 50,
  lyricY = 82,
  wind = 0.25,
  speed = 0.45,
  suspend = false,
}) {
  const style = normalizeParticleEffect(effect);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef(null);
  const active = style !== "none";

  useLayoutEffect(() => {
    if (!active || suspend) return undefined;
    const handle = delayRender("particles");
    try {
      const canvas = ref.current;
      const ctx = canvas ? contextOf(canvas) : null;
      if (ctx) {
        drawParticles(ctx, style, frame, fps, bass, mid, high, energy, transient, sourceX, sourceY, wind, speed);
      }
    } finally {
      continueRender(handle);
    }
    return undefined;
  }, [active, suspend, style, frame, fps, bass, mid, high, energy, transient, sourceX, sourceY, wind, speed]);

  if (suspend) {
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: `${lyricX}%`,
            top: `${lyricY}%`,
            width: 420,
            height: 92,
            transform: "translate(-50%, -50%)",
            border: "3px solid rgba(168, 85, 247, 0.95)",
            borderRadius: 16,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${sourceX}%`,
            top: `${sourceY}%`,
            width: 48,
            height: 48,
            transform: "translate(-50%, -50%)",
            border: "3px solid rgba(251, 191, 36, 0.95)",
            borderRadius: 999,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (!active) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <canvas
        ref={ref}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
}
