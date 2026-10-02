import { Loader2 } from "lucide-react";
import { energyLabel } from "@/services/assetAnalysis";
import { getPromoStylePreset } from "@/services/promoStylePresets";

export default function AssetAnalysisPanel({ profile, analyzing, onEnergy }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-700 uppercase tracking-[0.16em] text-primary">Asset analysis</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cover colors and track energy shape the visual template and the hooks saved with this campaign.
          </p>
        </div>
        {analyzing ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" /> : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          ["fast", "Fast / Aggressive"],
          ["slow", "Slow / Acoustic"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onEnergy?.(id)}
            className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-600 ${
              profile?.energy === id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-background text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {profile ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-background/60 p-3">
            <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground">Artwork</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg border border-border" style={{ background: profile.palette }} />
              <div>
                <p className="text-sm font-600">{profile.label}</p>
                <p className="text-xs text-muted-foreground">
                  {profile.template} · {profile.particleEffect === "smoke" ? "fog" : profile.particleEffect}
                </p>
                {profile.promoStylePreset ? (
                  <p className="text-[11px] text-primary/90">
                    Suggested promo: {getPromoStylePreset(profile.promoStylePreset).label}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-3">
            <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground">Audio</p>
            <p className="mt-2 text-sm font-600">{energyLabel(profile.energy)}</p>
            <p className="text-xs text-muted-foreground">
              {profile.energy === profile.detectedEnergy ? "Read from the track" : "Tagged by you"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground">Hooks</p>
            <ul className="mt-2 space-y-1.5">
              {(profile.hooks || []).map((hook) => (
                <li key={hook} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{hook}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{(profile.keywords || []).join(" · ")}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Upload artwork and a track to generate the profile.</p>
      )}
    </section>
  );
}
