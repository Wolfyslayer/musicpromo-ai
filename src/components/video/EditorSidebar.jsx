import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPORT_DURATIONS,
  FONT_CHOICES,
  PARTICLE_EFFECTS,
  normalizeParticleEffect,
} from "@/remotion/styles";

const PRO_MOTION_SNAPSHOTS = [
  {
    id: "hook-punch",
    label: "Hook punch",
    particle: "rings",
    look: { fontSize: 72, letterSpacing: 0.5, lyricY: 78, animationMs: 160, particleSpeed: 0.78 },
  },
  {
    id: "cinematic-slow",
    label: "Cinematic slow",
    particle: "leaks",
    look: { fontSize: 56, letterSpacing: 4, lyricY: 84, animationMs: 420, particleSpeed: 0.35 },
  },
  {
    id: "bass-shake",
    label: "Bass shake",
    particle: "shake",
    look: { fontSize: 64, letterSpacing: 1, lyricY: 80, animationMs: 240, particleSpeed: 0.9 },
  },
  {
    id: "clean-minimal",
    label: "Clean minimal",
    particle: "none",
    look: { fontSize: 52, letterSpacing: -0.2, lyricY: 86, animationMs: 320, particleSpeed: 0.4 },
  },
];

function Control({ label, value, min, max, step, suffix = "", onChange }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[Number(value) || 0]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0])}
      />
    </div>
  );
}

function PositionStage({ look, onLook }) {
  const stageRef = useRef(null);

  const place = (kind, event) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const round = (n) => Math.round(n * 10) / 10;
    if (kind === "lyric") {
      onLook({
        lyricX: round(Math.min(92, Math.max(8, x))),
        lyricY: round(Math.min(92, Math.max(8, y))),
      });
      return;
    }
    onLook({
      particleX: round(Math.min(100, Math.max(0, x))),
      particleY: round(Math.min(100, Math.max(0, y))),
    });
  };

  const bind = (kind) => ({
    onPointerDown: (event) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      place(kind, event);
    },
    onPointerMove: (event) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      place(kind, event);
    },
  });

  return (
    <div className="flex gap-3">
      <div
        ref={stageRef}
        className="relative aspect-[9/16] w-[132px] shrink-0 overflow-hidden rounded-xl border border-border bg-muted"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.07),transparent_68%)]" />
        <button
          type="button"
          aria-label="Particle source"
          className="absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/80 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
          style={{ left: `${look.particleX}%`, top: `${look.particleY}%` }}
          {...bind("particle")}
        />
        <button
          type="button"
          aria-label="Lyric position"
          className="absolute z-20 h-5 min-w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-violet-500 px-1 text-[8px] font-600 uppercase tracking-wide text-white shadow-[0_0_12px_rgba(139,92,246,0.7)]"
          style={{ left: `${look.lyricX}%`, top: `${look.lyricY}%` }}
          {...bind("lyric")}
        >
          Aa
        </button>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2 text-[11px] text-muted-foreground">
        <p>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-500" />
          Lyrics {look.lyricX}, {look.lyricY}
        </p>
        <p>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />
          Particles {look.particleX}, {look.particleY}
        </p>
        <p className="text-muted-foreground">Drag the dots on the 9:16 frame.</p>
      </div>
    </div>
  );
}

/**
 * Dark inspector for typography, placement, particles, and export length.
 */
export default function EditorSidebar({
  look,
  duration,
  particleEffect,
  onLook,
  onDuration,
  onEffect,
  durationChoices = EXPORT_DURATIONS,
  durationLocked = false,
  className = "",
}) {
  return (
    <aside className={cn("space-y-5 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-xl shadow-black/10", className)}>
      <div>
        <p className="text-[10px] font-600 uppercase tracking-[0.16em] text-muted-foreground">Export</p>
        <Label className="mt-2 block text-xs text-muted-foreground">Duration</Label>
        {durationLocked ? (
          <p className="mt-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-600">
            Full track · {duration}s
          </p>
        ) : (
          <Select value={String(durationChoices.includes(Number(duration)) ? duration : durationChoices[0])} onValueChange={(value) => onDuration(Number(value))}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {durationChoices.map((seconds) => (
                <SelectItem key={seconds} value={String(seconds)}>
                  {seconds}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-[10px] font-600 uppercase tracking-[0.16em] text-muted-foreground">Typography</p>
        <div className="grid grid-cols-3 gap-1.5">
          {FONT_CHOICES.map((font) => (
            <button
              key={font.id}
              type="button"
              onClick={() => onLook({ fontId: font.id })}
              className={`rounded-lg border px-2 py-2 text-left text-[11px] leading-tight ${
                look.fontId === font.id
                  ? "border-violet-400/70 bg-violet-500/15 text-white"
                  : "border-border bg-muted text-foreground hover:border-primary/40"
              }`}
            >
              {font.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs text-muted-foreground">Text color</Label>
          <input
            type="color"
            aria-label="Text color"
            value={look.textColor}
            onChange={(event) => onLook({ textColor: event.target.value })}
            className="h-8 w-12 cursor-pointer rounded border border-border bg-muted"
          />
        </div>
        <Control
          label="Font size"
          value={look.fontSize}
          min={36}
          max={96}
          step={1}
          suffix="px"
          onChange={(fontSize) => onLook({ fontSize })}
        />
        <Control
          label="Letter spacing"
          value={look.letterSpacing}
          min={-2}
          max={16}
          step={0.5}
          suffix="px"
          onChange={(letterSpacing) => onLook({ letterSpacing })}
        />
        <Control
          label="Animation speed"
          value={look.animationMs}
          min={80}
          max={900}
          step={10}
          suffix="ms"
          onChange={(animationMs) => onLook({ animationMs })}
        />
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-[10px] font-600 uppercase tracking-[0.16em] text-muted-foreground">Position</p>
        <PositionStage look={look} onLook={onLook} />
        <Control
          label="Lyrics X"
          value={look.lyricX}
          min={8}
          max={92}
          step={0.5}
          onChange={(lyricX) => onLook({ lyricX })}
        />
        <Control
          label="Lyrics Y"
          value={look.lyricY}
          min={8}
          max={92}
          step={0.5}
          onChange={(lyricY) => onLook({ lyricY })}
        />
        <Control
          label="Particle X"
          value={look.particleX}
          min={0}
          max={100}
          step={0.5}
          onChange={(particleX) => onLook({ particleX })}
        />
        <Control
          label="Particle Y"
          value={look.particleY}
          min={0}
          max={100}
          step={0.5}
          onChange={(particleY) => onLook({ particleY })}
        />
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-[10px] font-600 uppercase tracking-[0.16em] text-muted-foreground">Pro motion</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRO_MOTION_SNAPSHOTS.map((snap) => (
            <button
              key={snap.id}
              type="button"
              onClick={() => {
                onLook(snap.look);
                onEffect(snap.particle);
              }}
              className="rounded-xl border border-border bg-muted/60 px-2 py-2 text-left text-[11px] font-600 hover:border-primary/40"
            >
              {snap.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-[10px] font-600 uppercase tracking-[0.16em] text-muted-foreground">Particles</p>
        <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-3">
          {PARTICLE_EFFECTS.map((effect) => (
            <button
              key={effect.id}
              type="button"
              onClick={() => onEffect(effect.id)}
              className={`min-h-11 rounded-xl border px-2 py-2 text-left ${
                normalizeParticleEffect(particleEffect) === effect.id
                  ? "border-amber-300/70 bg-amber-400/10"
                  : "border-border bg-muted hover:border-primary/40"
              }`}
            >
              <p className="text-[11px] font-600 text-foreground">{effect.label}</p>
            </button>
          ))}
        </div>
        <Control
          label="Wind"
          value={look.wind}
          min={-1}
          max={1}
          step={0.05}
          onChange={(wind) => onLook({ wind })}
        />
        <Control
          label="Particle speed"
          value={look.particleSpeed}
          min={0.1}
          max={1}
          step={0.05}
          onChange={(particleSpeed) => onLook({ particleSpeed })}
        />
      </div>
    </aside>
  );
}
