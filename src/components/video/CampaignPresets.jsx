const PRESETS = [
  {
    id: "ai-studio",
    label: "AI Studio feel",
    seconds: 15,
    blurb: "Grain, sweeps, prism",
    look: { fontSize: 62, letterSpacing: 0.8, lyricY: 80, animationMs: 240, particleSpeed: 0.68 },
    artwork_motion: "ai-feel",
    particle_effect: "prism",
    visual_style: "electronic",
  },
  {
    id: "teaser",
    label: "Teaser Short",
    seconds: 15,
    blurb: "Stories and Shorts",
    look: { fontSize: 52, letterSpacing: -0.4, lyricY: 76, animationMs: 180, particleSpeed: 0.72 },
  },
  {
    id: "promo",
    label: "Full Promo",
    seconds: 30,
    blurb: "Reels tracking",
    look: { fontSize: 64, letterSpacing: 1.4, lyricY: 82, animationMs: 280, particleSpeed: 0.5 },
  },
  {
    id: "hype",
    label: "Extended Hype",
    seconds: 60,
    blurb: "Full particle length",
    look: { fontSize: 72, letterSpacing: 2, lyricY: 84, animationMs: 360, particleSpeed: 0.92 },
    artwork_motion: "hype",
    particle_effect: "sparks",
  },
];

export default function CampaignPresets({ activeDuration, onApply, allowedSeconds }) {
  const presets = allowedSeconds?.length
    ? PRESETS.filter((preset) => allowedSeconds.includes(preset.seconds))
    : PRESETS;
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
      <p className="text-[10px] font-700 uppercase tracking-[0.16em] text-primary">Campaign presets</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        AI Studio uses free Remotion polish — no cloud video API.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {presets.map((preset) => {
          const active = Number(activeDuration) === preset.seconds;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApply(preset)}
              className={`min-h-11 rounded-xl border px-3 py-2 text-left transition ${
                active ? "border-primary bg-primary/20" : "border-border/70 bg-background/60 hover:border-primary/40"
              }`}
            >
              <span className="block text-sm font-700">{preset.label}</span>
              <span className="block text-[11px] text-muted-foreground">
                {preset.seconds}s · {preset.blurb}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
