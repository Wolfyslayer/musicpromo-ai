import { cn } from "@/lib/utils";
import { PROMO_STYLE_PRESETS } from "@/services/promoStylePresets";

export default function PromoStylePicker({ value, onChange, className = "" }) {
  const active = value || PROMO_STYLE_PRESETS[0].id;
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-muted-foreground">
        Pick the overall promo look. The AI plan and video drafts will follow this style (with per-day tweaks).
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {PROMO_STYLE_PRESETS.map((preset) => {
          const selected = active === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.id)}
              className={cn(
                "rounded-2xl border p-3 text-left transition",
                selected
                  ? "border-primary/50 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                  : "border-border/70 bg-card/40 hover:border-primary/30"
              )}
            >
              <p className="text-sm font-600">{preset.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{preset.tagline}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
